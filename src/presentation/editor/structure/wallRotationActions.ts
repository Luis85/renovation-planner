import { computed, markRaw, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { Structure, Wall } from '../../../domain/spatial/Structure';
import { samePoint } from '../../../domain/spatial/Structure';
import { rotateWallStructure } from '../../../domain/spatial/rotateWall';
import type { PlanGeometrySnapshot } from '../../../application/ports/PlanGeometrySidecar';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { WriteLedger } from '../../../application/editor/WriteLedger';
import { sameGeometryDocument } from '../../../application/commands/spatial/sameGeometryDocument';
import { err } from '../../../core/result/Result';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useDialogStore } from '../../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { tr } from '../../i18n/strings';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import WallRotationForm from './WallRotationForm.vue';
import { createDraftRetry } from '../forms/createDraftRetry';

function hostWall(structure: Structure, id: string): Wall | undefined {
	const host = structure.openings.find(opening => opening.id === id)?.hostId ?? id;
	return structure.walls.find(wall => wall.id === host);
}
function sameWall(a: Wall, b: Wall): boolean {
	return a.id === b.id && samePoint(a.start, b.start) && samePoint(a.end, b.end) && a.height === b.height && a.thickness === b.thickness && (a.bulge ?? 0) === (b.bulge ?? 0);
}

/** Wall and opening selections share the existing reviewed StructureCommand write boundary. */
export function createWallRotationActions(context: PlanEditorContext,
	runtime: Pick<EditorRuntime, 'dispatcher' | 'refreshProjection'>, ledger: WriteLedger,
	state: { active: Ref<boolean>; preview: Ref<Structure | null>; blocked: Readonly<Ref<boolean>> }) {
	const project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), session = useRenovationSession(), dialogs = useDialogStore();
	const rotationBlocked = computed(() => state.blocked.value || editor.activeToolId !== 'select');
	const rotationHostId = ref<string | null>(null);
	let alive = true, epoch = 0;
	const retry = createDraftRetry(runtime.refreshProjection, () => alive, context.commands.logger);
	watch(() => [editor.activeToolId, session.perspective, selection.selectedIds.join('|')], () => { epoch += 1; if (rotationHostId.value !== null) { state.preview.value = null; rotationHostId.value = null; } }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; state.preview.value = null; rotationHostId.value = null; });
	/** Admission is distinct from a captured operation's lifetime: active is set after this gate. */
	function canStart(id: string): boolean {
		return alive && !state.active.value && !rotationBlocked.value && !dialogs.current
			&& selection.selectedIds.length === 1 && selection.selectedIds[0] === id;
	}
	function retired(captured: number): boolean {
		return !alive || epoch !== captured || rotationBlocked.value;
	}
	/** Preserve both the displayed document check and a pointer gesture's original wall check. */
	function matchesBaseline(baseline: PlanGeometrySnapshot, wall: Wall, original?: Wall): boolean {
		return sameGeometryDocument({ ...baseline.document, structure: project.structure, calibration: project.plan?.calibration ?? null }, baseline.document)
			&& (!original || sameWall(original, wall));
	}
	async function rotateWall(id: string, degrees = 0, original?: Wall): Promise<void> {
		const services = context.commands.structure, captured = epoch;
		if (!services || !canStart(id)) return;
		state.active.value = true;
		try {
			const read = await services.read(context.planId as PlanId);
			if (retired(captured)) return;
			if (!read.ok) { notifyOperationFailure(read.error); return; }
			const baseline = read.value, structure = baseline.document.structure;
			const wall = structure && hostWall(structure, id);
			if (!wall || !structure) return;
			if (!matchesBaseline(baseline, wall, original)) {
				notifyOperationFailure(staleWriteRefusal()); await runtime.refreshProjection(); return;
			}
			const formBlocked = computed(() => rotationBlocked.value || epoch !== captured), busy = ref(false);
			rotationHostId.value = wall.id;
			const name = tr('editor.structure.wall-number', { n: String(structure.walls.findIndex(candidate => candidate.id === wall.id) + 1) });
			await dialogs.openDialog({ kind: 'form', title: tr(id === wall.id ? 'editor.rotation.wall-title' : 'editor.rotation.host-title', { name }), component: markRaw(WallRotationForm), busy, props: {
				structure, wallId: wall.id, degrees, busy, blocked: formBlocked, retired: computed(() => epoch !== captured), retry, openSource: () => context.openPlanNote(),
				roomNames: Object.fromEntries(structure.boundaries.map(boundary => [boundary.roomId, project.zones.get(boundary.roomId)?.name ?? boundary.roomId])),
				preview: (value: Structure | null) => { state.preview.value = !retired(captured) ? value : null; },
				dispatch: (next: Structure) => retired(captured) ? Promise.resolve(err(staleWriteRefusal())) : runtime.dispatcher.run(services.command({ planId: context.planId as PlanId, baseline, structure: next, ledger })),
			} });
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.wall.rotation-failed'); }
		finally { state.active.value = false; state.preview.value = null; rotationHostId.value = null; }
	}
	function previewRotation(id: string | null, degrees?: number, original?: Wall): void {
		const wall = id === null ? undefined : hostWall(project.structure, id);
		const result = alive && !rotationBlocked.value && !state.active.value && wall && degrees !== undefined && (!original || sameWall(original, wall)) ? rotateWallStructure(project.structure, wall.id, degrees) : null;
		state.preview.value = result?.ok ? result.value : null;
		rotationHostId.value = result?.ok && wall ? wall.id : null;
	}
	return { rotateWall, previewRotation, rotationBlocked, rotationHostId };
}
