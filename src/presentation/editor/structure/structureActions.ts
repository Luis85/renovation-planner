import { removalSources } from '../planning/removalSources';
import type { PlanGeometryDocument, PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { AppError } from '../../../core/errors/AppError';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import { renovationReferents } from '../../../domain/renovation/renovationTargets';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { useRenovationSession } from '../renovation/renovationSession';
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
import { err, type Result } from '../../../core/result/Result';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { useSaveStateStore } from '../save-state/save-state-store';
import { editWall } from '../../../domain/spatial/structureGeometry';
function removalIds(id: string | readonly string[]): readonly string[] { return typeof id === 'string' ? [id] : [...new Set(id)]; }
function removalSummary(structure: Structure, selected: readonly string[], openings: number, rooms: number): string {
	const names = selected.map(target => {
		const wallIndex = structure.walls.findIndex(wall => wall.id === target);
		return wallIndex >= 0 ? tr('editor.structure.wall-number', { n: String(wallIndex + 1) }) : tr('renovation.geometry.opening');
	});
	return (selected.length > 1 ? tr('renovation.batch.scope', { count: String(selected.length) }) + ' ' + names.join(', ') + '. ' : '') + tr('editor.structure.delete-impact', { openings: String(openings), rooms: String(rooms) });
}

export function createStructureActions(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'dispatcher' | 'writesBlocked' | 'refreshProjection'>, ledger: WriteLedger) {
	const dialogs = useDialogStore(), project = useProjectStore(), selection = useSelectionStore();
	const preview = ref<Structure | null>(null), active = ref(false);
	const session = useRenovationSession(), save = useSaveStateStore(), blocked = computed(() => runtime.writesBlocked.value || save.state === 'saving' || session.perspective === 'review');
	let alive = true;
	onBeforeUnmount(() => { alive = false; preview.value = null; });
	function matchesProjection(document: PlanGeometryDocument): boolean {
		return sameGeometryDocument({ objects: [], structure: project.structure, calibration: project.plan?.calibration ?? null },
			{ objects: [], structure: document.structure, calibration: document.calibration });
	}
	function prepareBaseline(result: Result<PlanGeometrySnapshot, AppError>): { snapshot: PlanGeometrySnapshot | null; recovery: Promise<void> | null } {
		if (!result.ok) {
			notifyOperationFailure(result.error);
			return { snapshot: null, recovery: null };
		}
		if (matchesProjection(result.value.document)) return { snapshot: result.value, recovery: null };
		notifyOperationFailure(staleWriteRefusal());
		return { snapshot: null, recovery: runtime.refreshProjection() };
	}
	function unavailable(): boolean { return !alive || active.value || blocked.value || !!dialogs.current; }
	async function edit(id: string, end?: Point): Promise<void> {
		if (unavailable() || !context.commands.structure) return;
		active.value = true;
		const selected = selection.selectedIds.join();
		try {
			const baseline = await context.commands.structure.read(context.planId as PlanId);
			if (!alive || selection.selectedIds.join() !== selected || runtime.writesBlocked.value) return;
			const { snapshot, recovery } = prepareBaseline(baseline);
			if (!snapshot) { await recovery; return; }
			const structure = snapshot.document.structure;
			if (!structure || ![...structure.walls, ...structure.openings].some(item => item.id === id)) return;
			const busy = ref(false), services = context.commands.structure;
			await dialogs.openDialog({ kind: 'form', title: tr('editor.structure.edit'), component: markRaw(StructureEditForm), busy, props: {
				structure, id, end, busy, blocked,
				roomNames: structure.boundaries.filter(boundary => boundary.wallIds.includes(id)).map(boundary => project.zones.get(boundary.roomId)?.name ?? boundary.roomId),
				preview: (value: Structure | null) => { preview.value = value; },
				dispatch: (next: Structure) => !alive ? Promise.resolve(err(staleWriteRefusal())) : runtime.dispatcher.run(services.command({ planId: context.planId as PlanId, baseline: snapshot, structure: next, ledger })),
			} });
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.structure.edit-failed'); }
		finally { active.value = false; preview.value = null; }
	}
    async function referencesFor(ids: readonly string[]): Promise<readonly string[] | null> {
        const materials = await removalSources(context, ids);
        if (!alive) return null;
        if (!materials.ok) { notifyOperationFailure(materials.error); return null; }
        return [...materials.value, ...ids.flatMap(target => renovationReferents(project.plan?.renovation ?? EMPTY_RENOVATION, target))];
    }
	async function approveRemoval(structure: Structure, selected: readonly string[], ids: readonly string[], openings: number, rooms: number): Promise<boolean> {
		const references = await referencesFor(ids);
		if (!references) return false;
		if (references.length) {
			await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), message: tr('renovation.links', { names: references.join(', ') }) });
			return false;
		}
		const answer = await dialogs.openDialog({ kind: 'confirm', title: tr('editor.structure.delete'), danger: true,
			message: removalSummary(structure, selected, openings, rooms) });
		return answer === 'confirm';
	}

	async function remove(id: string | readonly string[]): Promise<void> {
		if (unavailable() || !context.commands.structure) return;
		const selected = removalIds(id);
		if (!selected.length) return;
		active.value = true;
		try {
			const baseline = await context.commands.structure.read(context.planId as PlanId);
			if (!alive) return;
			const { snapshot, recovery } = prepareBaseline(baseline);
			const structure = snapshot?.document.structure;
			if (!structure) { await recovery; return; }
			const removedOpenings = structure.openings.filter(item => selected.includes(item.id) || selected.includes(item.hostId));
			const removedBoundaries = structure.boundaries.filter(boundary => boundary.wallIds.some(wallId => selected.includes(wallId)));
			const ids = [...selected, ...removedOpenings.map(item => item.id)];
			const approved = await approveRemoval(structure, selected, ids, removedOpenings.length, removedBoundaries.length);
			if (!alive || !approved) return;
			const result = await runtime.dispatcher.run(context.commands.structure.command({ planId: context.planId as PlanId, baseline: snapshot, ledger,
				structure: { ...structure, walls: structure.walls.filter(item => !selected.includes(item.id)), openings: structure.openings.filter(item => !removedOpenings.includes(item)), boundaries: structure.boundaries.filter(item => !removedBoundaries.includes(item)) } }));
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
