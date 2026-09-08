<script setup lang="ts">
import { computed } from 'vue';
import { setIcon } from 'obsidian';
import type { Point } from '../../../core/geometry/Point';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { rotate } from '../../../core/geometry/operations';
import { currentLanguage } from '../../i18n/strings';
import type { ThemeTokens } from '../theme/themeTokens';

const props = defineProps<{
	geometry: { handle: Point; anchor: Point; pivot: Point };
	tokens: ThemeTokens;
	zoom: number;
	radiusPx: number;
	angle: number | null;
	visibleBounds?: BoundingBox;
}>();

// As with EvidencePins, the host supplies the real icon paths; the plugin owns no catalogue.
const iconHost = document.createElement('span');
setIcon(iconHost, 'rotate-cw');
const iconPaths = [...iconHost.querySelectorAll('path')].map(path => path.getAttribute('d') as string);
const iconStroke = { strokeWidth: 2, lineCap: 'round', lineJoin: 'round', listening: false } as const;
const positions = computed(() => {
	const { handle, anchor, pivot } = props.geometry;
	const points = props.angle === null ? [handle, anchor] : rotate({ points: [handle, anchor] }, props.angle * Math.PI / 180, pivot).points;
	return { handle: points[0], anchor: points[1], pivot };
});
// The template reads this only while an angle is present.
const angleLabel = computed(() => {
	const angle = props.angle as number;
	return `${angle > 0 ? '+' : ''}${new Intl.NumberFormat(currentLanguage(), { maximumFractionDigits: 1, useGrouping: false }).format(angle)}°`;
});
const labelPosition = computed(() => {
	const x = positions.value.handle.x - 28 / props.zoom, y = positions.value.handle.y - 40 / props.zoom;
	const visible = props.visibleBounds;
	return visible ? {
		x: Math.max(visible.min.x + 4 / props.zoom, Math.min(visible.max.x - 60 / props.zoom, x)),
		y: Math.max(visible.min.y + 4 / props.zoom, Math.min(visible.max.y - 24 / props.zoom, y)),
	} : { x, y };
});
</script>

<template>
	<VGroup :config="{ name: 'rotation-handle-glyph', listening: false }">
		<VLine :config="{ name: 'rotation-handle-stem', points: [positions.anchor.x, positions.anchor.y, positions.handle.x, positions.handle.y], stroke: tokens.accent, strokeWidth: 2 / zoom }" />
		<VCircle :config="{ name: 'rotation-handle-button', x: positions.handle.x, y: positions.handle.y, radius: radiusPx / zoom, stroke: tokens.accent, strokeWidth: 2 / zoom, fill: tokens.canvasBackground }" />
		<VGroup :config="{ name: 'rotation-handle-icon', x: positions.handle.x - 9 / zoom, y: positions.handle.y - 9 / zoom, scaleX: 0.75 / zoom, scaleY: 0.75 / zoom }">
			<VPath
				v-for="(path, index) in iconPaths"
				:key="index"
				:config="{ ...iconStroke, data: path, stroke: tokens.zoneLabel }"
			/>
		</VGroup>
		<template v-if="angle !== null">
			<VLine :config="{ name: 'rotation-pivot-guide', points: [positions.pivot.x, positions.pivot.y, positions.handle.x, positions.handle.y], stroke: tokens.accent, strokeWidth: 1 / zoom, dash: [4 / zoom, 4 / zoom] }" />
			<VCircle :config="{ name: 'rotation-pivot', x: positions.pivot.x, y: positions.pivot.y, radius: 4 / zoom, stroke: tokens.accent, strokeWidth: 2 / zoom, fill: tokens.canvasBackground }" />
			<VRect :config="{ name: 'rotation-angle-surface', x: labelPosition.x, y: labelPosition.y, width: 56 / zoom, height: 20 / zoom, cornerRadius: 4 / zoom, fill: tokens.canvasBackground, stroke: tokens.accent, strokeWidth: 1 / zoom }" />
			<VText :config="{ name: 'rotation-angle-label', x: labelPosition.x, y: labelPosition.y + 3 / zoom, width: 56 / zoom, height: 16 / zoom, align: 'center', text: angleLabel, fontSize: 13 / zoom, fill: tokens.zoneLabel }" />
		</template>
	</VGroup>
</template>
