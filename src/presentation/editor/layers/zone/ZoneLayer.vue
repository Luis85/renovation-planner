<script setup lang="ts">
/**
 * The Zone layer — this slice's main content.
 *
 * It iterates `ProjectStore.zones` and renders one `ZoneShape` per entry, **keyed by
 * `zone.id`** and never by array index or Konva instance identity, so Vue's
 * reconciliation stays correct when the zone list changes shape in slice 6.
 *
 * The layer, not a shape, carries the viewport transform — see `viewportTransform`.
 */
import { computed, ref, watch } from 'vue';
import type Konva from 'konva';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '../../../stores/ProjectStore';
import type { ThemeTokens } from '../../theme/themeTokens';
import type { NodeTransform } from '../../viewport/Viewport';
import type { Vector } from '../../../../core/geometry/Vector';
import { toZoneRenderModel } from './ZoneRenderModel';
import { captionPins, detailPlanCaptions, ZONE_CAPTION } from './captionPlacement';
import { enclosedByBoundary } from '../../../../domain/spatial/encloseRoom';
import { useDrawnStructure } from '../../structure/drawnStructure';
import ZoneShape from './ZoneShape.vue';
import { useSelectionStore } from '../../selection/selection-store';
import type { EvidencePin } from '../../planning/evidencePins';
import { useRenovationSession } from '../../renovation/renovationSession';
import { useWorkspaceStore } from '../../../stores/WorkspaceStore';
import type { BoundingBox } from '../../../../core/geometry/BoundingBox';
import type { SpatialObjectGeometry } from '../../../../application/ports/PlanGeometrySidecar';
import { usePlanHierarchyStore } from '../../../stores/PlanHierarchyStore';

const props = defineProps<{
	preview?: readonly SpatialObjectGeometry[];
	pins: readonly EvidencePin[];
	dimensionObstacles: readonly BoundingBox[];
	captionViewport: BoundingBox | null;
	transform: NodeTransform;
	tokens: ThemeTokens;
	visible: boolean;
	zoom: number;
	labelPreview?: { readonly id: string; readonly offset: Vector } | null;
}>();

const { zones } = storeToRefs(useProjectStore()), structure = useDrawnStructure();
const selection = useSelectionStore();
const session = useRenovationSession(), workspace = useWorkspaceStore();
const captionObstacles = computed(() => captionPins(props.pins, session.visible, workspace.layerVisibility.annotation));
const selected = computed(() => new Set<string>(selection.selectedIds));

const models = computed(() => {
	const preview = new Map(props.preview?.map(object => [object.id, object]));
	const label = props.labelPreview;
	return [...zones.value.values()].map(zone => toZoneRenderModel({ ...zone, ...preview.get(zone.id), ...(label?.id === zone.id ? { labelOffset: label.offset } : {}) }));
});
const enclosed = computed(() => new Set(models.value.filter(model => enclosedByBoundary(model, structure.value)).map(model => model.id)));

const { hierarchy } = storeToRefs(usePlanHierarchyStore());
const detailCaptions = computed(() => detailPlanCaptions(hierarchy.value.detailPlans));

/**
 * Every room caption's `1 / zoom` counter-scale (see `ZoneShape`'s caption docblock), written onto
 * the Konva nodes from this one watch instead of through each caption's config — which re-rendered
 * every room per zoom notch. A room mounted later is scaled when its group joins the layer: vue-konva
 * adds a group only after its captions, so the layer's Konva `add` event sees them. The listener is
 * bound through the node rather than as `@add` on `<VLayer>`, which Vue warns about on every render
 * of a fragment-rooted component. A rescan per `add` is one pass per room mounted, not per zoom.
 */
const layer = ref<{ getNode(): Konva.Layer } | null>(null);
let zoneLayer: Konva.Layer | undefined;
function counterScale(zoom: number): void {
	zoneLayer?.find(`.${ZONE_CAPTION}`).forEach(caption => caption.scale({ x: 1 / zoom, y: 1 / zoom }));
}
watch(layer, (component) => {
	if (component === null) return;
	zoneLayer = component.getNode();
	zoneLayer.on('add', () => counterScale(props.zoom));
	counterScale(props.zoom);
}, { immediate: true, flush: 'post' });
watch(() => props.zoom, counterScale);
</script>

<template>
	<VLayer
		ref="layer"
		:config="{
			name: 'zone',
			listening: false,
			visible: props.visible,
			...props.transform,
		}"
	>
		<ZoneShape
			v-for="model in models"
			:key="model.id"
			:model="model"
			:tokens="props.tokens"
			:zoom="props.zoom"
			:selected="selected.has(model.id)"
			:enclosed="enclosed.has(model.id)"
			:pins="captionObstacles"
			:dimension-obstacles="dimensionObstacles"
			:caption-viewport="captionViewport"
			:detail-caption="detailCaptions.get(model.id) ?? null"
		/>
	</VLayer>
</template>
