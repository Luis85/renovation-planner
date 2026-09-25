import type { PlanRepository } from '../../../application/ports/PlanRepository';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { EventBus } from '../../../core/events/EventBus';
import type { AppError } from '../../../core/errors/AppError';
import type { DiagnosticsLedger } from '../../../application/ports/diagnostics';
import type { PlanId } from '../../../domain/plan/PlanId';
import { withPlanRenovation } from '../../../domain/plan/Plan';
import { markUncompensated, type AffectedEntity } from '../../../application/commands/DispatchOutcome';
import { err, ok } from '../../../core/result/Result';
import { isSkippablePlanRefusal } from './ObsidianPlanRepository';

/**
 * The host already moved the user file. Update only matching links with conditional Plan writes.
 *
 * **A partial-write path, stamped rather than reshaped (ADR-0034).** On the first failure at
 * any step this returns immediately: plans already saved STAY saved, their
 * `PlanRenovationChanged` events STAY published, and plans later in index order are never
 * attempted. There is no compensation and no retry. Continuing past a failure, batching, or a
 * partial-success report are each a larger change with their own argument and none of them is
 * what this function does — so what changed here is only that a refusal which left writes
 * behind now SAYS so, naming the plans it wrote.
 *
 * **The stamp is conditional on a write having landed, and that condition is load-bearing.**
 * Under ADR-0034 a stamp is a vault-wide write block, so raising one over a rename that
 * changed nothing would pause every guarded command in the vault for a coherent vault. A
 * failure on the first plan returns the refusal untouched.
 *
 * **An UNREADABLE plan is skipped, not a refusal (owner ruling 14, census #23).** Every plan is
 * read before its evidence is checked, so a plan refusing a note-local way — the listing's own
 * `isSkippablePlanRefusal`, reused rather than copied — used to end every rename in the vault:
 * a failure notice for a rename that succeeded, and, after a landed save, a vault-wide incident
 * over a coherent vault. It is left as it is and recorded in the diagnostics ledger, the way
 * `ObsidianPlanRepository.listByProject` records one; any other read refusal still aborts.
 *
 * A skipped plan that cites the moved path keeps the old one: the skip also covers a
 * transient or not-yet-synced sidecar on a plan whose note is readable, nothing retries the
 * relocation when that plan becomes readable again, and the only trace is its diagnostics
 * entry, which lasts one session.
 *
 * `deps.events.publish` is the one step a throw can escape from rather than a `Result` — it is
 * outside the stamp for that reason, and `evidenceRenamed`'s own try/catch is where it lands.
 * A throw there after a landed save is still an unrecorded half-write; closing it means giving
 * the publish a failure channel, which is not this change.
 */
export async function relocateEvidence(deps: { plans: PlanRepository; index: ProjectIndex; events: EventBus; ledger: DiagnosticsLedger }, oldPath: string, newPath: string) {
 const written: AffectedEntity[] = [];
 // `markUncompensated` only when something is actually half-written. `written` is the loop's
 // own record rather than a count, because ADR-0034 asks a raise site to NAME what it left.
 // Only one of the ADR's three refuted sites is structurally unable to do that —
 // `undoDeleteResolution.ts:131`, whose `done` list is zero-argument closures exposing no id.
 // The other two (`ObsidianZoneRepository.ts:370`, `deleteResolution.ts:499`) could and
 // partly do; this site can too, because the id it needs is already in scope in the loop.
 const abort = <E extends AppError>(error: E) => err(written.length === 0 ? error : markUncompensated(error, written));
 for (const id of deps.index.getIdsByType('renovation-plan')) {
  const read = await deps.plans.getById(id as PlanId);
  if (!read.ok) {
   if (!isSkippablePlanRefusal(read.error)) return abort(read.error);
   deps.ledger.record('plan', id, read.error);
   continue;
  }
  const loaded = read.value, renovation = loaded?.entity.renovation;
  if (!loaded || !renovation?.depth) continue;
  const depth = renovation.depth;
  if (!depth.evidence.some(item => moved(item.path, oldPath))) continue;
  const evidence = depth.evidence.map(item => moved(item.path, oldPath) ? { ...item, path: newPath + item.path.slice(oldPath.length) } : item);
  const changed = withPlanRenovation(loaded.entity, { ...renovation, depth: { ...depth, evidence } });
  if (!changed.ok) return abort(changed.error);
  const saved = await deps.plans.save(changed.value, loaded.version);
  if (!saved.ok) return abort(saved.error);
  written.push({ entityKind: 'plan', entityId: loaded.entity.id });
  await deps.events.publish({ type: 'PlanRenovationChanged', payload: { planId: loaded.entity.id, projectId: loaded.entity.projectId } });
 }
 return ok(undefined);
}
function moved(path: string, previous: string): boolean { return path === previous || path.startsWith(previous + '/'); }
