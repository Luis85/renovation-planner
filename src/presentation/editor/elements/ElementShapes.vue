<script setup lang="ts">
import { computed } from 'vue';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import type { ThemeTokens } from '../theme/themeTokens';
import { ELEMENT_LABEL_FONT_PX, elementLabelLayout } from '../labels/labelLayout';
import { paintRulerMarks, rulerMarks } from '../layers/rulerGeometry';
import { screenPoint } from '../viewport/Viewport';
import type { Point } from '../../../core/geometry/Point';
import ElementShape from './ElementShape.vue';
import { itemColorInk, itemColorTint } from './itemColorAppearance';
import { hasPointHandles } from './ElementMove';
import { draftingKind, outlineKind } from '../../../domain/spatial/SpatialElement';
import { VERTEX_HANDLE_RADIUS_PX } from '../handleMetrics';
const props = defineProps<{ elements: readonly NamedSpatialElement[]; selectedIds: readonly string[]; tokens: ThemeTokens; zoom: number; editable?: boolean }>();
/**
 * A measurement is drawn as the set-scale tape (`GestureSketch.vue`): a 2 px spine with end bars
 * and ticks. The marks are pixel sizes, so they are laid out in layer-local pixels (world × zoom)
 * on a shape scaled back by 1 / zoom — the layer's own zoom cancels it, and a bar stays 14 px
 * at any zoom exactly as the tape's does.
 */
function rulerConfig(points: readonly Point[], stroke: string, zoom: number) {
	const pixel = (point: Point) => screenPoint(point.x * zoom, point.y * zoom);
	return { name: 'element-measurement-marks', marks: rulerMarks(pixel(points[0]), pixel(points[1])), sceneFunc: paintRulerMarks, stroke, scaleX: 1 / zoom, scaleY: 1 / zoom, perfectDrawEnabled: false, listening: false };
}
/** An arrow draws its own handles; an empty list keeps the template flat for fallow's complexity budget. */
function pointHandles(element: NamedSpatialElement, single: boolean, zoom: number, tokens: ThemeTokens) {
	if (!single || element.kind === 'arrow' || !hasPointHandles(element.kind)) return [];
	return element.points.map(vertex => ({ name: 'element-vertex', x: vertex.x, y: vertex.y, radius: VERTEX_HANDLE_RADIUS_PX / zoom, fill: tokens.canvasBackground, stroke: tokens.accent, strokeWidth: 2 / zoom }));
}
const shapes = computed(() => props.elements.map(element => {
	const selected = props.selectedIds.includes(element.id), closed = outlineKind(element.kind), ruler = element.kind === 'measurement' && element.points.length === 2;
	const zoom = props.zoom, tokens = props.tokens, ink = closed ? undefined : element.color, stroke = selected ? tokens.accent : itemColorInk(ink, tokens.zoneStroke), label = elementLabelLayout(element, zoom);
	const single = props.editable === true && selected && props.selectedIds.length === 1;
	return { id: element.id, name: 'element-' + element.kind, element, selected, single, structural: element.kind === 'post' || element.kind === 'beam', drafting: draftingKind(element.kind), stair: element.kind === 'stair' ? element.stair : undefined, handles: pointHandles(element, single, zoom, tokens), marks: ruler ? rulerConfig(element.points, stroke, zoom) : null,
		line: { points: element.points.flatMap(vertex => [vertex.x, vertex.y]), closed, stroke, strokeWidth: (selected && !ruler ? 3 : 2) / zoom, dash: element.kind === 'fence' ? [4 / zoom, 4 / zoom] : [], fill: closed ? itemColorTint(element.color, tokens.canvasBackground) : undefined},
		// A drafting mark draws its own name where the name IS the mark, and shows none elsewhere (plan drafting tools design §6).
		label: draftingKind(element.kind) ? null : { ...label, fontSize: ELEMENT_LABEL_FONT_PX / zoom, fill: tokens.zoneLabel, listening: false } };
}));
</script>
<template>
	<VGroup>
		<VGroup
			v-for="shape in shapes"
			:key="shape.id"
			:config="{ name: shape.name + ' ' + shape.id }"
		>
			<ElementShape
				:shape="shape"
				:tokens="tokens"
				:zoom="zoom"
			/>
		</VGroup>
	</VGroup>
</template>
