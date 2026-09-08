import { computed, markRaw, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import type { Wall } from '../../../domain/spatial/Structure';
import type { SessionWriteLedger } from '../../../application/editor/WriteLedger';
import type { EditorRuntime } from '../runtime';
import type { PlanEditorContext } from '../PlanEditorContext';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useDialogStore } from '../../dialogs/dialog-store';
import { createDraftRetry } from '../forms/createDraftRetry';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { err } from '../../../core/result/Result';
import { staleWriteRefusal } from '../tools/with-stale-gate';
import { tr } from '../../i18n/strings';
import { screenPoint, screenToWorld, STAGE_PIXELS, worldPerScreenPixel } from '../viewport/Viewport';
import ObjectRotationForm from './ObjectRotationForm.vue';
import { rotationChanged, rotationDegreesBetween, rotationHandleGeometry, rotationPivot, rotationPoints, type NamedRotationShape, type RotationShape } from './objectRotation';
import { projectedRotationTarget, readRotationBaseline, type RotationBaseline } from './rotationBaseline';
import { layoutRotationControls } from './rotationControl';

export interface WallRotationActions {
	readonly active: Readonly<Ref<boolean>>;
	rotateWall(id: string, degrees?: number, original?: Wall): Promise<void>;
	previewRotation(id: string | null, degrees?: number, original?: Wall): void;
}
type Runtime = Pick<EditorRuntime, 'activeToolId' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'renderState' | 'openPlanNote'> & { elementActions: { readonly active: Readonly<Ref<boolean>> }; ledger: SessionWriteLedger; wall?: WallRotationActions; groupRotationTarget?: (memberId: string) => NamedRotationShape | null };
/** One transient rotation lifetime; persistence remains in the existing source-specific commands. */
export function createRotationActions(context: PlanEditorContext, runtime: Runtime) {
	const project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), saves = useSaveStateStore(), session = useRenovationSession(), dialogs = useDialogStore();
	const workspace = useWorkspaceStore(), obstacles = shallowRef<readonly BoundingBox[]>([]);
	const working = ref(false), generation = ref(0), preview = ref<NamedRotationShape | null>(null);
	let alive = true;
	const target = computed(() => {
		if (selection.selectedIds.length !== 1) return selection.selectedIds.length > 1 ? runtime.groupRotationTarget?.(selection.selectedIds[0]) ?? null : null;
		const shape = projectedRotationTarget(project, selection.selectedIds[0], Boolean(runtime.wall));
		return shape && rotationPivot(shape) ? { ...shape, generation: generation.value } : null;
	});
	const active = computed(() => working.value || (runtime.wall?.active.value ?? false));
	function permitted(shape: NamedRotationShape | null): boolean {
		return alive && shape !== null && !runtime.writesBlocked.value && saves.state !== 'saving' && runtime.activeToolId.value === 'select' && session.perspective !== 'review' && !runtime.elementActions.active.value
			&& (session.perspective === 'plan' || ['room', 'area', 'wall'].includes(shape.kind));
	}
	const blocked = computed(() => !permitted(target.value));
	const displayTarget = computed(() => {
		const id = runtime.renderState.rotationHoverId;
		if (!id || editor.pointerWorld === null || runtime.renderState.rotationHoverSuppressed) return null;
		if (selection.selectedIds.length > 1 && selection.selectedIds.some(selectedId => selectedId === id)) return runtime.groupRotationTarget?.(id) ?? null;
		if (target.value?.id === id) return target.value;
		const group = runtime.groupRotationTarget?.(id); if (group) return group;
		const shape = projectedRotationTarget(project, id, Boolean(runtime.wall));
		return shape && rotationPivot(shape) ? { ...shape, generation: generation.value } : null;
	});
	function clear(): void { preview.value = null; runtime.renderState.previewPolygon = null; runtime.renderState.rotationDegrees = null; runtime.renderState.rotationInteraction = null; runtime.renderState.rotationHoverId = null; runtime.wall?.previewRotation(null); }
	watch(() => [runtime.activeToolId.value, session.perspective, selection.selectedIds.join('|')], () => { generation.value++; clear(); }, { flush: 'sync' });
	onBeforeUnmount(() => { alive = false; generation.value++; clear(); });
	const retry = createDraftRetry(runtime.refreshProjection, () => alive, context.commands.logger);
	const visibleBounds = computed(() => ({ min: screenToWorld(screenPoint(0, 0), editor.viewport, STAGE_PIXELS), max: screenToWorld(screenPoint(editor.stageSize.width, editor.stageSize.height), editor.viewport, STAGE_PIXELS) }));
	function sourceVisible(shape: NamedRotationShape): boolean {
		if (shape.kind === 'group') return shape.visible === true;
		return shape.kind === 'room' || shape.kind === 'area' ? workspace.layerVisibility.zone : workspace.layerVisibility.architecture;
	}
	const handleGeometry = computed(() => {
		const shape = target.value; if (!shape || !sourceVisible(shape)) return null;
		const scale = worldPerScreenPixel(editor.viewport, STAGE_PIXELS), visible = visibleBounds.value;
		return rotationHandleGeometry(shape, scale, visible, obstacles.value);
	});
	const displayControls = computed(() => {
		const shape = displayTarget.value;
		if (!permitted(shape) || !shape || active.value || !sourceVisible(shape)) return [];
		const pivot = rotationPivot(shape);
		return pivot ? layoutRotationControls(shape, pivot, worldPerScreenPixel(editor.viewport, STAGE_PIXELS), visibleBounds.value, obstacles.value) : [];
	});
	function previewShape(id: string | null, points?: readonly Point[]): void {
		if (id === null) { clear(); return; }
		const shape = target.value;
		if (!alive || blocked.value || !shape || shape.id !== id || !points) { clear(); return; }
		preview.value = { ...shape, points };
		if (shape.kind === 'room' || shape.kind === 'area') runtime.renderState.previewPolygon = points;
		if (shape.kind === 'wall') runtime.wall?.previewRotation(id, rotationDegreesBetween(shape.points, points), shape.wall);
	}
	async function operate(id: string, action: (baseline: RotationBaseline, epoch: number) => Promise<void>): Promise<void> {
		const shape = target.value;
		if (!alive || blocked.value || active.value || dialogs.current || !shape || shape.id !== id) return;
		const epoch = generation.value; working.value = true;
		try {
			const baseline = await readRotationBaseline(context, project, shape, runtime.ledger);
			if (!alive || epoch !== generation.value || blocked.value) return;
			if (!baseline.ok) { notifyOperationFailure(baseline.error); await runtime.refreshProjection(); return; }
			await action(baseline.value, epoch);
		} catch (cause) { if (alive) notifyFault(cause, context.commands.logger, 'editor.rotation.failed'); }
		finally { working.value = false; clear(); }
	}
	async function move(id: string, points: readonly Point[], original: RotationShape): Promise<void> {
		if (original.generation !== undefined && original.generation !== generation.value) return;
		if (!rotationChanged(original.points, points)) return;
		if (original.kind === 'wall') { if (!blocked.value && !active.value) await runtime.wall?.rotateWall(id, rotationDegreesBetween(original.points, points), original.wall); return; }
		await operate(id, async baseline => {
			if (baseline.shape.kind !== original.kind || JSON.stringify(baseline.shape.points) !== JSON.stringify(original.points) || JSON.stringify(baseline.shape.bulges) !== JSON.stringify(original.bulges)) { notifyOperationFailure(staleWriteRefusal()); return; }
			const result = await runtime.dispatcher.run(baseline.command(points)); if (alive && !result.ok) notifyOperationFailure(result.error);
		});
	}
	async function rotate(id: string, degrees?: number): Promise<void> {
		if (target.value?.id !== id) return;
		if (target.value?.kind === 'wall') { if (!blocked.value && !active.value) await runtime.wall?.rotateWall(id, degrees); return; }
		await operate(id, async (baseline, epoch) => {
			const element = baseline.shape, pivot = rotationPivot(element); if (!pivot) return;
			const latest = ref<string | null>(null), busy = ref(false);
			const dispatch = async (points: readonly Point[]) => {
				if (!alive || epoch !== generation.value || blocked.value || latest.value) return err(staleWriteRefusal());
				const result = await runtime.dispatcher.run(baseline.command(points));
				if (alive && !result.ok && (result.error.code.includes('conflict') || result.error.code.includes('external-modification') || result.error.code === 'undo.superseded')) { latest.value = tr('editor.element.changed'); await runtime.refreshProjection(); }
				return result;
			};
			if (degrees !== undefined) { const points = rotationPoints(element, degrees, pivot); if (points && rotationChanged(element.points, points)) { const result = await dispatch(points); if (alive && !result.ok) notifyOperationFailure(result.error); } return; }
			await dialogs.openDialog({ kind: 'form', title: tr('editor.rotation.title', { name: element.name }), component: markRaw(ObjectRotationForm), busy, props: { element, pivot, busy, blocked, latest, inputBlocked: computed(() => saves.state === 'saving' || saves.unrecoveredWrite || latest.value !== null), retry, openSource: runtime.openPlanNote, logger: context.commands.logger, dispatch,
				preview: (points: readonly Point[] | null) => { if (alive && epoch === generation.value && points) previewShape(id, points); else clear(); },
			} });
		});
	}
	function canRotateId(id?: string): boolean {
		const shape = id !== undefined && target.value?.id !== id ? displayTarget.value : target.value;
		return (id === undefined || shape?.id === id) && !active.value && permitted(shape);
	}
	return { setObstacles: (bounds: readonly BoundingBox[]) => { obstacles.value = bounds; }, obstacles: computed(() => obstacles.value), target, displayTarget, displayControls, canRotateId,
		active, blocked, preview, previewShape, handleGeometry, visibleBounds, handle: computed(() => handleGeometry.value?.handle ?? null), available: computed(() => target.value !== null), rotate, move };
}
