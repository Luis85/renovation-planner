import { computed, onBeforeUnmount, ref } from 'vue';
import type { AppError } from '../../../core/errors/AppError';
import { ok, type Result } from '../../../core/result/Result';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { sameElementMetadata } from '../../../domain/spatial/SpatialElement';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { renovationReferents } from '../../../domain/renovation/renovationTargets';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import { DeleteSelectionCommand } from '../../../application/commands/spatial/DeleteSelectionCommand';
import { spatialRemovalInput } from '../../../application/commands/spatial/spatialRemovalInput';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { removalSources } from '../planning/removalSources';
import { structureRecords } from '../structure/structureRecords';
import { deleteZoneHistory } from '../add/createZoneHistory';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { tr } from '../../i18n/strings';
import type { RenovationBaseline } from '../../../application/commands/renovation/RenovationCommand';

type Proposal = ReturnType<typeof spatialRemovalInput>;

/** Deletes a selection of two or more Rooms, Areas, walls, openings and elements as one confirmed, undoable step. */
export function createSpatialRemoval(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'activeToolId' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'structureTask'>) {
 const project = useProjectStore(), dialogs = useDialogStore(), selection = useSelectionStore(), save = useSaveStateStore(), session = useRenovationSession();
 const active = ref(false), blocked = computed(() => runtime.writesBlocked.value || save.state === 'saving' || session.perspective === 'review' || runtime.activeToolId.value !== 'select');
 let alive = true; onBeforeUnmount(() => { alive = false; });
 function matches(baseline: RenovationBaseline): boolean {
  const document = baseline.geometry.document;
  return sameElementMetadata(project.plan?.spatialElements, baseline.plan.entity.spatialElements)
   && sameGeometryDocument({ objects: [], groups: project.groups, structure: project.structure, intended: project.intended, calibration: project.plan?.calibration ?? null },
    { ...document, objects: [], structure: document.structure ?? EMPTY_STRUCTURE });
 }
 /** The selected Rooms and Areas a Requirement still refers to: only their own Delete can reassign or remove those. */
 async function referencedZones(zoneIds: readonly string[]): Promise<Result<string[], AppError>> {
  const names: string[] = [];
  for (const zone of [...project.zones.values()].filter(item => zoneIds.includes(item.id))) {
   const groups = await context.queries.listRequirementsReferencing(zone.id);
   if (!groups.ok) return groups;
   if (groups.value.length) names.push(zone.name);
  }
  return ok(names);
 }
 async function approve(baseline: RenovationBaseline, selected: readonly string[], zoneIds: readonly string[], proposal: Proposal): Promise<boolean> {
  const ids = [...zoneIds, ...proposal.ids];
  const [materials, referenced] = await Promise.all([removalSources(context, ids), referencedZones(zoneIds)]);
  if (!alive) return false;
  if (!materials.ok) { notifyOperationFailure(materials.error); return false; }
  if (!referenced.ok) { notifyOperationFailure(referenced.error); return false; }
  const references = [...materials.value, ...ids.flatMap(id => renovationReferents(baseline.plan.entity.renovation ?? EMPTY_RENOVATION, id))];
  if (references.length || referenced.value.length) {
   const message = references.length ? tr('renovation.links', { names: references.join(', ') }) : tr('editor.structure.delete-referenced', { names: referenced.value.join(', ') });
   await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), message }); return false;
  }
  const zones = [...project.zones.values()].filter(item => zoneIds.includes(item.id)).map(item => item.name);
  const names = [...zones, ...structureRecords(baseline.geometry.document.structure ?? EMPTY_STRUCTURE, context.planId, baseline.plan.entity.spatialElements).filter(item => selected.includes(item.id)).map(item => item.name)];
  const impact = zoneIds.length ? tr('editor.structure.delete-selection-impact', { deleted: String(zoneIds.length), openings: String(proposal.openings) })
   : tr('editor.structure.delete-impact', { openings: String(proposal.openings), rooms: String(proposal.rooms) });
  return await dialogs.openDialog({ kind: 'confirm', title: tr(zoneIds.length ? 'editor.structure.delete-selection' : 'editor.structure.delete'), danger: true,
   message: tr('renovation.batch.scope', { count: String(selected.length) }) + ' ' + names.join(', ') + '. ' + impact }) === 'confirm';
 }
 function unavailable(): boolean { return !alive || active.value || blocked.value || !!dialogs.current; }
 function stillCurrent(selected: string): boolean { return alive && !blocked.value && selection.selectedIds.join('|') === selected; }
 async function remove(ids: readonly string[]): Promise<void> {
  const services = context.commands.renovation, selected = [...new Set(ids)], selectionAtStart = selection.selectedIds.join('|');
  if (unavailable() || !services || selected.length < 2) return;
  active.value = true;
  try {
   const read = await services.read(context.planId as PlanId);
   if (!stillCurrent(selectionAtStart)) return;
   if (!read.ok) { notifyOperationFailure(read.error); return; }
   if (!matches(read.value)) { notifyOperationFailure(staleWriteRefusal()); await runtime.refreshProjection(); return; }
   const document = read.value.geometry.document, records = structureRecords(document.structure ?? EMPTY_STRUCTURE, context.planId);
   const zoneIds = selected.filter(id => document.objects.some(item => item.id === id)), structureIds = selected.filter(id => !zoneIds.includes(id));
   if (!structureIds.every(id => records.some(item => item.id === id))) return;
   const proposal = spatialRemovalInput(read.value, structureIds);
   const approved = await approve(read.value, selected, zoneIds, proposal);
   if (!stillCurrent(selectionAtStart) || !approved) return;
   const ledger = runtime.structureTask.ledger;
   const command = new DeleteSelectionCommand({ deleteRoom: zoneId => deleteZoneHistory(context, ledger, { zoneId }), renovation: services, ledger },
    { baseline: read.value, roomIds: zoneIds as ZoneId[], structureIds });
   const result = await runtime.dispatcher.run(command);
   if (alive && !result.ok) notifyOperationFailure(result.error);
  } catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.element.remove-failed'); }
  finally { active.value = false; }
 }
 return { remove, active };
}
