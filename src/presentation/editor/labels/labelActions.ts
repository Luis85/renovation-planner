import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import type { Vector } from '../../../core/geometry/Vector';
import type { SessionWriteLedger } from '../../../application/editor/WriteLedger';
import type { PlanEditorContext } from '../PlanEditorContext';
import type { EditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { useSelectionStore } from '../selection/selection-store';
import { useSaveStateStore } from '../save-state/save-state-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useDialogStore } from '../../dialogs/dialog-store';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { captionBottom, captionPins, detailPlanCaptions, roomCaptionAnchor, type NumberedPin } from '../layers/zone/captionPlacement';
import { usePlanHierarchyStore } from '../../stores/PlanHierarchyStore';
import { labelAnchor, toZoneRenderModel } from '../layers/zone/ZoneRenderModel';
import type { DimensionObstacleLayout } from '../resize/useDimensionObstacles';
import { projectedElement, projectedRotationTarget, readRotationBaseline } from '../elements/rotationBaseline';
import { elementCaptionLayout, roomCaptionBounds, textLabelBounds, type LabelHit } from './labelLayout';

/**
 * Canvas captions a renovator drags (ADR-0029): which captions a press could grab, and the one write
 * a drop makes. The offset travels the zone's and the element's existing guarded writes
 * (`rotationBaseline.ts`), so a caption drag has their stale check, history and conflict refusal.
 */
export function createLabelActions(context: PlanEditorContext, runtime: Pick<EditorRuntime, 'activeToolId' | 'dispatcher' | 'writesBlocked' | 'refreshProjection' | 'renderState'> & { readonly ledger: SessionWriteLedger }) {
	const project = useProjectStore(), editor = useEditorStore(), workspace = useWorkspaceStore(), shapes = useAssetShapeStore(), plans = usePlanHierarchyStore();
	const selection = useSelectionStore(), saves = useSaveStateStore(), session = useRenovationSession(), dialogs = useDialogStore();
	// A zone some plan details draws a third caption line (ADR-0028), so its caption is taller and maybe wider.
	const detailCaptions = computed(() => detailPlanCaptions(plans.hierarchy.detailPlans));
	const pins = shallowRef<readonly NumberedPin[]>([]), dimensions = shallowRef<DimensionObstacleLayout>({ bounds: [], viewport: null });
	const working = ref(false);
	let alive = true;
	onBeforeUnmount(() => { alive = false; runtime.renderState.labelPreview = null; });
	const blocked = computed(() => working.value || runtime.writesBlocked.value || saves.state === 'saving' || session.perspective !== 'plan' || runtime.activeToolId.value !== 'select');

	/** A room caption is grabbed where it is DRAWN, pin displacement included, so its hit offset is drawn minus automatic. */
	function hitFor(id: string, zoom: number): LabelHit | null {
		const zone = project.zones.get(id);
		if (zone) {
			const detail = detailCaptions.value.get(id) ?? null, model = toZoneRenderModel(zone);
			const drawn = roomCaptionAnchor(zone, zoom, captionPins(pins.value, session.visible, workspace.layerVisibility.annotation), dimensions.value.bounds, { viewport: dimensions.value.viewport, bottom: captionBottom(detail !== null) });
			const automatic = labelAnchor(zone.points, zone.bulges);
			return { id, bounds: roomCaptionBounds(drawn, zoom, { label: model.label, areaMm2: model.areaMm2, detail }), offset: { dx: drawn.x - automatic.x, dy: drawn.y - automatic.y } };
		}
		const element = projectedElement(project, id);
		if (!element) return null;
		return { id, bounds: textLabelBounds(elementCaptionLayout(element, shapes.shapeOf, zoom), zoom), offset: element.labelOffset ?? { dx: 0, dy: 0 } };
	}
	const hits = computed<readonly LabelHit[]>(() => blocked.value ? [] : selection.selectedIds.flatMap(id => hitFor(String(id), editor.viewport.zoom) ?? []));

	async function move(id: string, offset: Vector): Promise<void> {
		const shape = projectedRotationTarget(project, id, false);
		try {
			if (!alive || blocked.value || dialogs.current || !shape) return;
			working.value = true;
			const baseline = await readRotationBaseline(context, project, shape, runtime.ledger);
			if (!alive) return;
			if (!baseline.ok) { notifyOperationFailure(baseline.error); await runtime.refreshProjection(); return; }
			const result = await runtime.dispatcher.run(baseline.value.labelCommand(offset));
			// A save that failed is reported even from a leaf closed while it ran: the renovator's drop was lost.
			if (!result.ok) notifyOperationFailure(result.error);
		} catch (cause) { notifyFault(cause, context.commands.logger, 'editor.label.failed'); }
		finally {
			working.value = false;
			// A drop leaves its preview up until here, however the write ended.
			if (runtime.renderState.labelPreview?.id === id) runtime.renderState.labelPreview = null;
		}
	}

	return { hits, move, setCaptionContext: (evidence: readonly NumberedPin[], layout: DimensionObstacleLayout) => { pins.value = evidence; dimensions.value = layout; } };
}
