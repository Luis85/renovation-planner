<script setup lang="ts">
import { computed } from 'vue';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import type { ThemeTokens } from '../theme/themeTokens';
import { currentLanguage, tr } from '../../i18n/strings';

const props = defineProps<{ handle: Point; controlBounds: BoundingBox; zoom: number; tokens: ThemeTokens; angle: number | null; snapDegrees: number | null; visibleBounds?: BoundingBox; obstacles: readonly BoundingBox[] }>();
const format = (value: number): string => new Intl.NumberFormat(currentLanguage(), { maximumFractionDigits: 1, useGrouping: false }).format(value);
const title = computed(() => props.angle === null ? tr('editor.rotation.drag-hint') : `${props.angle > 0 ? '+' : ''}${format(props.angle)}°`);
const detail = computed(() => props.angle === null ? tr('editor.rotation.click-hint')
	: `${tr(props.angle < 0 ? 'editor.rotation.direction.counterclockwise' : 'editor.rotation.direction.clockwise')}${props.snapDegrees === null ? '' : ` · ${tr('editor.rotation.snap-feedback', { step: format(props.snapDegrees) })}`}`);
const layout = computed(() => {
	const scale = 1 / props.zoom, visible = props.visibleBounds;
	const width = Math.min(240 * scale, visible ? visible.max.x - visible.min.x - 8 * scale : 240 * scale), height = 48 * scale, gap = 8 * scale;
	const box = props.controlBounds;
	const candidates = [
		{ x: props.handle.x - width / 2, y: box.min.y - height - gap },
		{ x: props.handle.x - width / 2, y: box.max.y + gap },
		{ x: box.min.x - width - gap, y: props.handle.y - height / 2 },
		{ x: box.max.x + gap, y: props.handle.y - height / 2 },
	].map(point => visible ? { x: Math.max(visible.min.x + 4 * scale, Math.min(visible.max.x - width - 4 * scale, point.x)), y: Math.max(visible.min.y + 4 * scale, Math.min(visible.max.y - height - 4 * scale, point.y)) } : point);
	const position = candidates.find(point => [box, ...props.obstacles].every(obstacle => point.x + width + gap <= obstacle.min.x || point.x - gap >= obstacle.max.x || point.y + height + gap <= obstacle.min.y || point.y - gap >= obstacle.max.y)) ?? candidates[0];
	return { ...position, width, height };
});
</script>
<template>
	<VGroup :config="{ name: 'rotation-feedback', x: layout.x, y: layout.y, listening: false }">
		<VRect :config="{ name: 'rotation-feedback-surface', width: layout.width, height: layout.height, cornerRadius: 5 / zoom, fill: tokens.canvasBackground, stroke: tokens.accent, strokeWidth: 1 / zoom }" />
		<VText :config="{ name: angle === null ? 'rotation-help-label' : 'rotation-angle-label', x: 8 / zoom, y: 6 / zoom, width: layout.width - 16 / zoom, height: 18 / zoom, text: title, fontSize: 14 / zoom, fontStyle: 'bold', fill: tokens.zoneLabel }" />
		<VText :config="{ name: 'rotation-instruction-label', x: 8 / zoom, y: 26 / zoom, width: layout.width - 16 / zoom, height: 18 / zoom, text: detail, fontSize: 12 / zoom, fill: tokens.zoneLabel }" />
	</VGroup>
</template>
