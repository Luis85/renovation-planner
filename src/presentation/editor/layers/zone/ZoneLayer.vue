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
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '../../../stores/ProjectStore';
import type { ThemeTokens } from '../../theme/themeTokens';
import type { NodeTransform } from '../../viewport/Viewport';
import { toZoneRenderModel } from './ZoneRenderModel';
import { enclosedByBoundary } from '../../../../domain/spatial/encloseRoom';
import { useDrawnStructure } from '../../structure/drawnStructure';
import ZoneShape from './ZoneShape.vue';
import { useSelectionStore } from '../../selection/selection-store';
import type { EvidencePin } from '../../planning/evidencePins';
import { useRenovationSession } from '../../renovation/renovationSession';
import { useWorkspaceStore } from '../../../stores/WorkspaceStore';
import type { BoundingBox } from '../../../../core/geometry/BoundingBox';
import type { SpatialObjectGeometry } from '../../../../application/ports/PlanGeometrySidecar';

const props = defineProps<{
	preview?: readonly SpatialObjectGeometry[];
	pins: readonly EvidencePin[];
	dimensionObstacles: readonly BoundingBox[];
	captionViewport: BoundingBox | null;
	transform: NodeTransform;
	tokens: ThemeTokens;
	visible: boolean;
	zoom: number;
}>();

const { zones } = storeToRefs(useProjectStore()), structure = useDrawnStructure();
const selection = useSelectionStore();
const session = useRenovationSession(), workspace = useWorkspaceStore();
const captionObstacles = computed(() => session.visible && workspace.layerVisibility.annotation ? props.pins : []);
const selected = computed(() => new Set<string>(selection.selectedIds));

const models = computed(() => {
	const preview = new Map(props.preview?.map(object => [object.id, object]));
	return [...zones.value.values()].map(zone => toZoneRenderModel({ ...zone, ...preview.get(zone.id) }));
});
const enclosed = computed(() => new Set(models.value.filter(model => enclosedByBoundary(model, structure.value)).map(model => model.id)));
</script>

<template>
	<VLayer
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
		/>
	</VLayer>
</template>
