<script setup lang="ts">
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { ThemeTokens } from '../theme/themeTokens';
import { closedChain } from '../../../domain/spatial/structureGeometry';
import { formatMetres } from '../shell/formatLength';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
const props = defineProps<{ points: readonly Point[]; cursor: Point | null; tokens: ThemeTokens; zoom: number; viewport: BoundingBox }>();
const corners = computed(() => closedChain(props.points) ? props.points.slice(0, -1) : props.points);
const segments = computed(() => {
 const points = [...props.points];
 if (!closedChain(points) && props.cursor && points.length && Math.hypot(props.cursor.x - points[points.length - 1].x, props.cursor.y - points[points.length - 1].y) > 1) points.push(props.cursor);
 return points.slice(1).map((end, index) => {
  const start = points[index], length = Math.hypot(end.x - start.x, end.y - start.y);
  return { x: (start.x + end.x) / 2 + (end.y - start.y) / length * 22 / props.zoom,
   y: (start.y + end.y) / 2 - (end.x - start.x) / length * 22 / props.zoom, text: `${formatMetres(length)} m` };
 });
});
const angle = computed(() => {
 const count = props.points.length, end = props.cursor;
 if (count < 2 || !end || closedChain(props.points)) return null;
 const vertex = props.points[count - 1], previous = props.points[count - 2];
 const incoming = Math.atan2(previous.y - vertex.y, previous.x - vertex.x), outgoing = Math.atan2(end.y - vertex.y, end.x - vertex.x);
 if (Math.hypot(end.x - vertex.x, end.y - vertex.y) < 1) return null;
 const turn = Math.atan2(Math.sin(outgoing - incoming), Math.cos(outgoing - incoming));
 const points = Array.from({ length: 13 }, (_, index) => {
  const direction = incoming + turn * index / 12;
  return [vertex.x + Math.cos(direction) * 28 / props.zoom, vertex.y + Math.sin(direction) * 28 / props.zoom];
 }).flat();
 return { points, x: vertex.x + Math.cos(incoming + turn / 2) * 48 / props.zoom,
  y: vertex.y + Math.sin(incoming + turn / 2) * 48 / props.zoom, text: `${Math.round(Math.abs(turn) * 180 / Math.PI)}°` };
});
function caption(x: number, y: number) { return { x, y, scaleX: 1 / props.zoom, scaleY: 1 / props.zoom, listening: false }; }
function measurementCaption(x: number, y: number) {
	const { min, max } = props.viewport, horizontal = 44 / props.zoom, vertical = 18 / props.zoom;
	return { ...caption(Math.max(min.x + horizontal, Math.min(max.x - horizontal, x)), Math.max(min.y + vertical, Math.min(max.y - vertical, y))),
		visible: x >= min.x - horizontal && x <= max.x + horizontal && y >= min.y - vertical && y <= max.y + vertical };
}
</script>
<template>
	<VGroup :config="{ name: 'wall-draft', listening: false }">
		<VLine
			v-if="points.length > 1"
			:config="{ name: 'wall-draft-outline', points: points.flatMap(point => [point.x, point.y]), stroke: tokens.accent, strokeWidth: 2 / zoom, listening: false }"
		/>
		<VGroup
			v-for="(point, index) in corners"
			:key="index"
			:config="caption(point.x, point.y)"
		>
			<VRect :config="{ name: 'wall-draft-corner', x: -5, y: -5, width: 10, height: 10, stroke: tokens.accent, strokeWidth: 1.5, fill: tokens.canvasBackground }" />
			<VCircle :config="{ x: -12, y: -24, radius: 11, fill: tokens.canvasBackground, stroke: tokens.accent, strokeWidth: 1.5 }" />
			<VText :config="{ name: 'wall-draft-corner-label', x: -23, y: -31, width: 22, align: 'center', text: String.fromCharCode(65 + index % 26), fontSize: 13, fill: tokens.accent }" />
		</VGroup>
		<VGroup
			v-for="(segment, index) in segments"
			:key="index"
			:config="measurementCaption(segment.x, segment.y)"
		>
			<VRect :config="{ x: -40, y: -14, width: 80, height: 28, cornerRadius: 4, fill: tokens.canvasBackground, stroke: tokens.accent, strokeWidth: 1 }" />
			<VText :config="{ name: 'wall-draft-length', x: -40, y: -7, width: 80, align: 'center', text: segment.text, fontSize: 13, fill: tokens.accent }" />
		</VGroup>
		<template v-if="angle">
			<VLine :config="{ name: 'wall-draft-angle', points: angle.points, stroke: tokens.accent, strokeWidth: 1 / zoom, dash: [3 / zoom, 3 / zoom] }" />
			<VText :config="{ ...measurementCaption(angle.x, angle.y), name: 'wall-draft-angle-label', offsetX: 20, width: 40, align: 'center', text: angle.text, fontSize: 13, fill: tokens.accent }" />
		</template>
	</VGroup>
</template>
