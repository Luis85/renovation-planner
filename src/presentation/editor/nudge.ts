import type { Ref } from 'vue';
import type { WriteLedger } from '../../application/editor/WriteLedger';
import { translate } from '../../core/geometry/operations';
import type { Polygon } from '../../core/geometry/Polygon';
import type { Vector } from '../../core/geometry/Vector';
import type { ZoneId } from '../../domain/zone/ZoneId';
import type { useProjectStore } from '../stores/ProjectStore';
import type { useSelectionStore } from './selection/selection-store';
import type { PlanEditorContext } from './PlanEditorContext';
import { reportDispatchFailure, type ToolDispatcher } from './report-failure';
import type { ToolId } from './tools/editor-tool';
import { moveGesture } from './tools/registerEditorTools';

/**
 * E8's fix (Task 14): this leaf's answer to the one operation §85 left unreachable by
 * keyboard, over the SAME `moveGesture` factory `SelectTool`'s drag builds from — so undo
 * restores a keyboard nudge exactly as it restores a drag, with nothing here to keep in
 * step with that tool.
 *
 * Pulled out of `runtime.ts` rather than kept as a nested function there: that file sits at
 * its 400-line `max-lines` cap, and the second Codex P2 finding below could not be answered
 * inside it without extraction — the same reason `commitField` and `inspector-wiring.ts`
 * left it before.
 *
 * **Two Codex P2 findings, two different halves of this function answer them.**
 * `resolveNudgeTarget` runs SYNCHRONOUSLY, on every call, before anything is chained: not
 * Select, zero or several selected are each a "there is nothing a single translate could
 * mean" case rather than a validation the chained step owns. The chained step
 * (`runNudge`) is only ever handed a zone id already resolved this way.
 *
 * The chaining itself is the FIRST finding's fix: `chain` is private to this leaf's nudge
 * action, not `deps.dispatcher.run`'s own queue — that queue only serializes the WRITE, one
 * step later than the geometry read this closure takes. `projectStore.zones` is refreshed
 * only by the dispatch's own queued projection refresh, so two arrow taps arriving before
 * the first refresh lands would both read the same stale `zone.points` and the second
 * dispatch would overwrite the first translation instead of accumulating it. Chaining the
 * geometry read and the dispatch — never the selection read — defers the second tap's WRITE
 * until the first has fully resolved, so every tap's write reads what the previous one
 * actually wrote.
 *
 * **The SECOND finding is what moved the selection read out of that chain.** Deferring the
 * whole call — selection included — meant a press queued behind a slow write picked up
 * whatever was selected once the chain finally reached it, rather than what was selected at
 * key-down: selecting a different room, or clearing the selection, before the chain advanced
 * moved the NEW selection or silently no-oped instead of moving the room the key press was
 * actually for. `resolveNudgeTarget` answers that by reading `activeToolId` and
 * `selection.selectedIds` at the moment of the call, capturing a single `ZoneId` (or nothing)
 * before the chain is ever touched. A no-op (nothing resolved) returns an already-resolved
 * promise WITHOUT joining `chain` at all — a press with nothing worth nudging must not
 * occupy a slot a later, valid press would then have to wait behind.
 *
 * **A captured zone id can still be gone by the time its turn comes**: deleted by another
 * leaf, or by a sync, while the press sat queued behind a slow write. `runNudge`'s
 * `zones.get` lookup answers that case as a no-op, same as it always has — the id was real
 * when the key was pressed, and there is no geometry left to translate now that it is not.
 *
 * No `.catch` here: the branded `ToolDispatcher` this closure calls is guaranteed never to
 * reject (`mapDispatchFaults`), so a catch arm would be the unreachable-guard shape this
 * repository restructures around rather than leaves uncovered.
 */
export function createNudgeSelectionAction(deps: {
	readonly context: PlanEditorContext;
	readonly ledger: WriteLedger;
	readonly dispatcher: ToolDispatcher;
	readonly activeToolId: Ref<ToolId | null>;
	readonly selection: ReturnType<typeof useSelectionStore>;
	readonly projectStore: ReturnType<typeof useProjectStore>;
}): (by: Vector) => Promise<void> {
	function resolveNudgeTarget(): ZoneId | null {
		if (deps.activeToolId.value !== 'select') return null;
		const [zoneId, ...rest] = deps.selection.selectedIds;
		if (zoneId === undefined || rest.length > 0) return null;
		return zoneId as ZoneId;
	}
	async function runNudge(zoneId: ZoneId, by: Vector): Promise<void> {
		const zone = deps.projectStore.zones.get(String(zoneId));
		if (zone === undefined) return;
		const inverse: Polygon = { points: zone.points };
		const forward = translate(inverse, by);
		const result = await deps.dispatcher.run(
			moveGesture(deps.context, deps.ledger)(zoneId, forward, inverse),
		);
		if (!result.ok) reportDispatchFailure(result.error);
	}
	let chain: Promise<void> = Promise.resolve();
	return (by) => {
		const zoneId = resolveNudgeTarget();
		if (zoneId === null) return Promise.resolve();
		chain = chain.then(() => runNudge(zoneId, by));
		return chain;
	};
}
