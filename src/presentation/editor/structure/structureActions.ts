import { computed, markRaw, onBeforeUnmount, ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { Structure } from '../../../domain/spatial/Structure';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useDialogStore } from '../../dialogs/dialog-store';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { tr } from '../../i18n/strings';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import StructureEditForm from './StructureEditForm.vue';
import { err } from '../../../core/result/Result';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { useSaveStateStore } from '../save-state/save-state-store';
import { editWall } from '../../../domain/spatial/structureGeometry';

export function createStructureActions(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'dispatcher' | 'writesBlocked' | 'refreshProjection'>, ledger: WriteLedger) {
	const dialogs = useDialogStore(), project = useProjectStore(), selection = useSelectionStore();
	const preview = ref<Structure | null>(null), active = ref(false);
	const save = useSaveStateStore(), blocked = computed(() => runtime.writesBlocked.value || save.state === 'saving');
	let alive = true;
	onBeforeUnmount(() => { alive = false; preview.value = null; });
	async function edit(id: string, end?: Point): Promise<void> {
		if (!alive || active.value || blocked.value || dialogs.current || !context.commands.structure) return;
		active.value = true;
		const selected = selection.selectedIds.join();
		try {
			const baseline = await context.commands.structure.read(context.planId as PlanId);
			if (!alive || selection.selectedIds.join() !== selected || runtime.writesBlocked.value) return;
			if (!baseline.ok) { notifyOperationFailure(baseline.error); return; }
			const structure = baseline.value.document.structure;
			if (!structure || ![...structure.walls, ...structure.openings].some(item => item.id === id)) return;
			const busy = ref(false), services = context.commands.structure;
			await dialogs.openDialog({ kind: 'form', title: tr('editor.structure.edit'), component: markRaw(StructureEditForm), busy, props: {
				structure, id, end, busy, blocked,
				roomNames: structure.boundaries.filter(boundary => boundary.wallIds.includes(id)).map(boundary => project.zones.get(boundary.roomId)?.name ?? boundary.roomId),
				preview: (value: Structure | null) => { preview.value = value; },
				dispatch: (next: Structure) => !alive ? Promise.resolve(err(staleWriteRefusal())) : runtime.dispatcher.run(services.command({ planId: context.planId as PlanId, baseline: baseline.value, structure: next, ledger })),
			} });
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); }
		finally { active.value = false; preview.value = null; }
	}
	async function remove(id: string): Promise<void> {
		if (!alive || active.value || blocked.value || dialogs.current || !context.commands.structure) return;
		active.value = true;
		try {
			const baseline = await context.commands.structure.read(context.planId as PlanId);
			if (!alive) return;
			if (!baseline.ok) { notifyOperationFailure(baseline.error); return; }
			const structure = baseline.value.document.structure;
			if (!structure) return;
			const removedOpenings = structure.openings.filter(item => item.id === id || item.hostId === id);
			const removedBoundaries = structure.boundaries.filter(boundary => boundary.wallIds.includes(id));
			const answer = await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), danger: true,
				message: tr('editor.structure.delete-impact', { openings: String(removedOpenings.length), rooms: String(removedBoundaries.length) }) });
			if (!alive || answer !== 'confirm') return;
			const result = await runtime.dispatcher.run(context.commands.structure.command({ planId: context.planId as PlanId, baseline: baseline.value, ledger,
				structure: { walls: structure.walls.filter(item => item.id !== id), openings: structure.openings.filter(item => !removedOpenings.includes(item)), boundaries: structure.boundaries.filter(item => !removedBoundaries.includes(item)) } }));
			if (alive && !result.ok) notifyOperationFailure(result.error);
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.structure.delete-failed'); }
		finally { active.value = false; }
	}
	function previewWall(id: string | null, end?: Point): void {
		const wall = project.structure.walls.find(item => item.id === id);
		preview.value = alive && wall && end ? editWall(project.structure, { ...wall, end }) : null;
	}
	return { edit, remove, preview, previewWall, active };
}
