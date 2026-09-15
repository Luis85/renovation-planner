<script setup lang="ts">
import { computed } from 'vue';
import type Konva from 'konva';
import type { Point } from '../../../core/geometry/Point';

const props = defineProps<{ polygons: readonly (readonly Point[])[]; color: string; edge: boolean; zoom: number }>();
/** One nonzero fill unions the bodies without anti-aliased seams between touching pieces. */
const polygons = computed(() => props.polygons.flatMap(points => {
	if (!points.length) return [];
	const origin = points[0];
	const area = points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length]; return sum + (point.x - origin.x) * (next.y - origin.y) - (next.x - origin.x) * (point.y - origin.y); }, 0);
	return Math.abs(area) > 1e-9 ? [area > 0 ? points : points.toReversed()] : [];
}));
function draw(context: Konva.Context, shape: Konva.Shape): void {
	context.beginPath();
	for (const points of polygons.value) {
		context.moveTo(points[0].x, points[0].y);
		for (const point of points.slice(1)) context.lineTo(point.x, point.y);
		context.closePath();
	}
	context.fillStrokeShape(shape);
}
</script>
<template>
	<VShape :config="{ name: edge ? 'wall-side-edges' : 'wall-side-bodies', sceneFunc: draw, fill: color, stroke: color, strokeEnabled: edge, strokeWidth: 2 / zoom, lineJoin: 'miter', listening: false }" />
</template>
