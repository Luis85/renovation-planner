<script setup lang="ts">
import { computed } from 'vue';
import { setIcon } from 'obsidian';
import { rotate } from '../../../core/geometry/operations';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { ThemeTokens } from '../theme/themeTokens';
import { tr } from '../../i18n/strings';
import { ROTATION_CONTROL_TOP_PX, ROTATION_CONTROL_BOTTOM_PX } from '../handleMetrics';
import { rotationControlBounds, type RotationControlGeometry } from './rotationControl';
import RotationFeedback from './RotationFeedback.vue';

const props = defineProps<{
	geometry: RotationControlGeometry; tokens: ThemeTokens; zoom: number; radiusPx: number;
	angle: number | null; dragging: boolean; highlighted: boolean; snapDegrees: number | null;
	visibleBounds?: BoundingBox; obstacles: readonly BoundingBox[];
}>();
function iconPaths(name: string): string[] {
	const host = document.createElement('span'); setIcon(host, `lucide-${name}`);
	return [...host.querySelectorAll('path')].map(path => path.getAttribute('d') as string);
}
const icons = { clockwise: iconPaths('rotate-cw'), counterclockwise: iconPaths('rotate-ccw') };
const iconStroke = { strokeWidth: 2, lineCap: 'round', lineJoin: 'round', listening: false } as const;
const positions = computed(() => {
	const { handle, anchor, pivot } = props.geometry;
	const points = props.dragging && props.angle !== null ? rotate({ points: [handle, anchor] }, props.angle * Math.PI / 180, pivot).points : [handle, anchor];
	return { handle: points[0], anchor: points[1], pivot };
});
const bounds = computed(() => rotationControlBounds(positions.value.handle, props.geometry.widthPx, 1 / props.zoom));
const direction = computed(() => props.angle !== null && props.angle < 0 ? 'counterclockwise' : 'clockwise');
</script>
<template>
	<VGroup :config="{ name: 'rotation-handle-glyph', listening: false }">
		<VLine :config="{ name: 'rotation-handle-stem', points: [positions.anchor.x, positions.anchor.y, positions.handle.x, positions.handle.y], stroke: tokens.accent, strokeWidth: 1 / zoom }" />
		<VRect :config="{ name: 'rotation-control-target', x: bounds.min.x, y: bounds.min.y, width: geometry.widthPx / zoom, height: (ROTATION_CONTROL_TOP_PX + ROTATION_CONTROL_BOTTOM_PX) / zoom, cornerRadius: 6 / zoom, fill: tokens.accent, opacity: highlighted ? 0.12 : 0 }" />
		<VCircle :config="{ name: 'rotation-handle-button', x: positions.handle.x, y: positions.handle.y, radius: radiusPx / zoom, stroke: tokens.accent, strokeWidth: 2 / zoom, fill: tokens.canvasBackground }" />
		<VGroup :config="{ name: 'rotation-handle-icon', x: positions.handle.x - 9 / zoom, y: positions.handle.y - 9 / zoom, scaleX: 0.75 / zoom, scaleY: 0.75 / zoom }">
			<VPath
				v-for="(path, index) in icons[direction]"
				:key="index"
				:config="{ ...iconStroke, data: path, stroke: tokens.zoneLabel }"
			/>
		</VGroup>
		<VRect :config="{ x: bounds.min.x, y: positions.handle.y + 17 / zoom, width: geometry.widthPx / zoom, height: 20 / zoom, cornerRadius: 4 / zoom, fill: tokens.canvasBackground }" />
		<VText :config="{ name: 'rotation-control-label', x: bounds.min.x + 4 / zoom, y: positions.handle.y + 20 / zoom, width: (geometry.widthPx - 8) / zoom, height: 16 / zoom, align: 'center', text: tr(geometry.hostWall ? 'editor.rotation.host-label' : 'editor.rotation.label'), fontSize: 13 / zoom, fill: tokens.zoneLabel }" />
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
			/>
		</template>
	</VGroup>
</template>
