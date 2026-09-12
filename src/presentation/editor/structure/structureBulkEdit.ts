import { markRaw, onBeforeUnmount, ref, type Ref } from 'vue';
import type { Structure } from '../../../domain/spatial/Structure';
import { hasDimensionTargets } from '../../../domain/spatial/structureDimensions';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { AppError } from '../../../core/errors/AppError';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import { err, type Result } from '../../../core/result/Result';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useSelectionStore } from '../selection/selection-store';
import { notifyFault } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import StructureBulkEditForm from './StructureBulkEditForm.vue';

/**
 * Several walls, windows and doors resized through ONE reviewed StructureCommand write, so one
 * undo reverts the whole set. It takes the single edit's admission and stale-baseline checks
 * rather than restating them.
 */
export function createStructureBulkEdit(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'dispatcher' | 'writesBlocked'>, ledger: WriteLedger, state: {
	readonly active: Ref<boolean>; readonly preview: Ref<Structure | null>; readonly blocked: Readonly<Ref<boolean>>;
	readonly unavailable: () => boolean;
	readonly prepareBaseline: (result: Result<PlanGeometrySnapshot, AppError>) => { snapshot: PlanGeometrySnapshot | null; recovery: Promise<void> | null };
}) {
	const dialogs = useDialogStore(), selection = useSelectionStore();
	let alive = true;
	onBeforeUnmount(() => { alive = false; });
	async function editMany(ids: readonly string[]): Promise<void> {
		const services = context.commands.structure;
		if (state.unavailable() || !services) return;
		state.active.value = true;
		const selected = selection.selectedIds.join();
		try {
			const read = await services.read(context.planId as PlanId);
			if (!alive || selection.selectedIds.join() !== selected || runtime.writesBlocked.value) return;
			const { snapshot, recovery } = state.prepareBaseline(read);
			if (!snapshot) { await recovery; return; }
			const structure = snapshot.document.structure;
			if (!structure || !hasDimensionTargets(structure, ids)) return;
			const busy = ref(false);
			await dialogs.openDialog({ kind: 'form', title: tr('editor.structure.bulk.edit'), component: markRaw(StructureBulkEditForm), busy, props: {
				structure, ids, busy, blocked: state.blocked,
				preview: (value: Structure | null) => { state.preview.value = alive ? value : null; },
				dispatch: (next: Structure) => !alive ? Promise.resolve(err(staleWriteRefusal())) : runtime.dispatcher.run(services.command({ planId: context.planId as PlanId, baseline: snapshot, structure: next, ledger })),
			} });
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); }
		finally { state.active.value = false; state.preview.value = null; }
	}
	return { editMany };
}
