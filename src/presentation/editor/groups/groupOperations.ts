import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { PlanGeometryDocument, PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { leftWritesBehind } from '../../../application/commands/DispatchOutcome';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import { err } from '../../../core/result/Result';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useDialogStore } from '../../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { captureGroup, projectedGroupGeometry, type GroupSnapshot } from './groupSnapshot';
import { adjustedNeighbours } from './groupTransforms';
import { tr } from '../../i18n/strings';
import { EMPTY_STRUCTURE } from '../../../domain/spatial/Structure';

export type GroupOperationRuntime = Pick<EditorRuntime, 'activeToolId' | 'dispatcher' | 'writesBlocked' | 'refreshProjection'> & { ledger: WriteLedger; spatialBusy?: () => boolean };
/** Capture display intent synchronously; obtain the conditional write version before any dialog. */
export function createGroupOperations(context: PlanEditorContext, runtime: GroupOperationRuntime) {
	const project = useProjectStore(), selection = useSelectionStore(), saves = useSaveStateStore(), session = useRenovationSession(), dialogs = useDialogStore();
	const document = computed(() => projectedGroupGeometry(project)), generation = ref(0), working = ref(false);
	const preview = shallowRef<PlanGeometryDocument | null>(null);
	let alive = true;
	const blocked = computed(() => !alive || !context.commands.groups || runtime.writesBlocked.value || runtime.spatialBusy?.() === true || saves.state === 'saving'
		|| runtime.activeToolId.value !== 'select' || session.perspective === 'review');
	watch(() => JSON.stringify([runtime.activeToolId.value, session.perspective, selection.selectedIds, document.value]), () => {
		generation.value++; preview.value = null;
	}, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; generation.value++; preview.value = null; });
	function capture(ids: readonly string[], single = false): GroupSnapshot | null {
		if (!alive || blocked.value || working.value || dialogs.current) return null;
		const snapshot = captureGroup(document.value, ids, generation.value, single);
		return snapshot && membersPermitted(snapshot) ? snapshot : null;
	}
	function membersPermitted(snapshot: GroupSnapshot): boolean {
		return session.perspective === 'plan' || !snapshot.document.structure?.elements?.some(element => snapshot.memberIds.includes(element.id));
	}
	function current(snapshot: GroupSnapshot): boolean {
		return alive && !blocked.value && membersPermitted(snapshot) && snapshot.generation === generation.value && sameGeometryDocument(snapshot.document, document.value);
	}
	async function operate(snapshot: GroupSnapshot, action: (baseline: PlanGeometrySnapshot, dispatch: (next: PlanGeometryDocument) => Promise<DispatchResult>) => Promise<void>): Promise<void> {
		const services = context.commands.groups;
		if (!services || !current(snapshot) || working.value || dialogs.current) return;
		working.value = true;
		try {
			const read = await services.read(context.planId as PlanId);
			if (!current(snapshot)) return;
			if (!read.ok) { notifyOperationFailure(read.error); return; }
			if (!sameGeometryDocument({ ...read.value.document, structure: read.value.document.structure ?? EMPTY_STRUCTURE }, snapshot.document)) { notifyOperationFailure(staleWriteRefusal()); await runtime.refreshProjection(); return; }
			let spent = false;
			await action(read.value, async next => {
				if (spent || !current(snapshot)) return err(staleWriteRefusal());
				const result = await runtime.dispatcher.run(services.command({ planId: context.planId as PlanId, baseline: read.value, document: next, ledger: runtime.ledger }));
				// A failed readback never authorizes replay against the original captured document.
				spent = result.ok ? result.value === 'wrote' : leftWritesBehind(result.error);
				return result;
			});
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.group.failed'); }
		finally { generation.value++; working.value = false; preview.value = null; }
	}
	async function commit(snapshot: GroupSnapshot, next: PlanGeometryDocument): Promise<boolean> {
		if (sameGeometryDocument(snapshot.document, next)) return current(snapshot);
		let saved = false;
		await operate(snapshot, async (_baseline, dispatch) => {
			const count = adjustedNeighbours(snapshot, next);
			if (count) {
				preview.value = next;
				const accepted = await dialogs.openDialog({ kind: 'confirm', title: tr('editor.group.connected-title'),
					message: tr('editor.group.connected-hint', { count: String(count) }), confirmLabel: tr('editor.rename.apply') });
				if (accepted !== 'confirm') return;
			}
			const result = await dispatch(next); saved = result.ok; if (alive && !result.ok) notifyOperationFailure(result.error);
		});
		return saved && alive;
	}
	return { document, generation, working, blocked, preview, capture, current, operate, commit };
}
