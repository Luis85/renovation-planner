<script setup lang="ts">
import { computed } from 'vue';
import { rotate } from '../../../core/geometry/operations';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { ThemeTokens } from '../theme/themeTokens';
import { ROTATION_CONTROL_SIZE_PX } from '../handleMetrics';
import { rotationControlBounds, type RotationControlGeometry } from './rotationControl';
import RotateArrowIcon from './RotateArrowIcon.vue';
import RotationFeedback from './RotationFeedback.vue';

const props = defineProps<{
	geometry: RotationControlGeometry; tokens: ThemeTokens; zoom: number;
	angle: number | null; dragging: boolean; highlighted: boolean; snapDegrees: number | null;
	visibleBounds?: BoundingBox; obstacles: readonly BoundingBox[];
}>();
const positions = computed(() => {
	const { handle, anchor, pivot } = props.geometry;
	const points = props.dragging && props.angle !== null ? rotate({ points: [handle, anchor] }, props.angle * Math.PI / 180, pivot).points : [handle, anchor];
	return { handle: points[0], anchor: points[1], pivot };
});
const bounds = computed(() => rotationControlBounds(positions.value.handle, 1 / props.zoom));
const direction = computed(() => props.angle !== null && props.angle < 0 ? 'counterclockwise' : 'clockwise');
</script>
<template>
	<VGroup :config="{ name: 'rotation-handle-glyph', listening: false }">
		<VLine :config="{ name: 'rotation-handle-stem', points: [positions.anchor.x, positions.anchor.y, positions.handle.x, positions.handle.y], stroke: tokens.accent, strokeWidth: 1 / zoom }" />
		<VRect :config="{ name: 'rotation-control-target', x: bounds.min.x, y: bounds.min.y, width: ROTATION_CONTROL_SIZE_PX / zoom, height: ROTATION_CONTROL_SIZE_PX / zoom, cornerRadius: 6 / zoom, fill: tokens.accent, opacity: highlighted ? 0.12 : 0 }" />
		<RotateArrowIcon
			:at="positions.handle"
			:world-per-pixel="1 / zoom"
			:tokens="tokens"
			:direction="direction"
		/>
		<template v-if="highlighted || dragging">
			<VLine :config="{ name: 'rotation-pivot-guide', points: [positions.pivot.x, positions.pivot.y, positions.handle.x, positions.handle.y], stroke: tokens.accent, strokeWidth: 1 / zoom, dash: [4 / zoom, 4 / zoom] }" />
			<VCircle :config="{ name: 'rotation-pivot', x: positions.pivot.x, y: positions.pivot.y, radius: 4 / zoom, stroke: tokens.accent, strokeWidth: 2 / zoom, fill: tokens.canvasBackground }" />
			<RotationFeedback
				:handle="positions.handle"
				:control-bounds="bounds"
				:zoom="zoom"
				:tokens="tokens"
				:angle="dragging ? angle : null"
				:snap-degrees="snapDegrees"
				:visible-bounds="visibleBounds"
				:obstacles="obstacles"
				:host-wall="geometry.hostWall"
			/>
		</template>
	</VGroup>
</template>
