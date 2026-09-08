<script setup lang="ts">
import { computed } from 'vue';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { elementLength } from '../../../domain/spatial/SpatialElement';
import type { ThemeTokens } from '../theme/themeTokens';
import { formatMetres } from '../shell/formatLength';
const props = defineProps<{ elements: readonly NamedSpatialElement[]; selectedIds: readonly string[]; tokens: ThemeTokens; zoom: number }>();
const shapes = computed(() => props.elements.map(element => {
	const selected = props.selectedIds.includes(element.id), closed = element.kind === 'object';
	const point = element.points[0], zoom = props.zoom, tokens = props.tokens;
	return { id: element.id, name: 'element-' + element.kind,
		line: { points: element.points.flatMap(vertex => [vertex.x, vertex.y]), closed, stroke: selected ? tokens.accent : tokens.zoneStroke, strokeWidth: (selected ? 3 : 2) / zoom, dash: element.kind === 'fence' ? [4 / zoom, 4 / zoom] : [], fill: closed ? tokens.canvasBackground : undefined },
		label: point ? { x: point.x, y: point.y - 18 / zoom, text: element.kind === 'measurement' ? element.name + ' · ' + formatMetres(elementLength(element)) + ' m' : element.name, fontSize: 12 / zoom, fill: tokens.zoneLabel, listening: false } : null };
}));
</script>
<template>
	<VGroup>
		<VGroup
			v-for="shape in shapes"
			:key="shape.id"
			:config="{ name: shape.name + ' ' + shape.id }"
		>
			<VLine :config="shape.line" />
			<VText
				v-if="shape.label"
				:config="shape.label"
			/>
		</VGroup>
	</VGroup>
</template>

