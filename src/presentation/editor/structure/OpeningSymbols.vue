<script setup lang="ts">
import { computed } from 'vue';
import type { Opening, Wall } from '../../../domain/spatial/Structure';
import type { ThemeTokens } from '../theme/themeTokens';
import { openingSymbol } from '../../../domain/spatial/openingGeometry';
const props = defineProps<{ openings: readonly Opening[]; walls: readonly Wall[]; selectedIds: readonly string[]; tokens: ThemeTokens; zoom: number }>();
const symbols = computed(() => props.openings.flatMap(opening => {
	const host = props.walls.find(wall => wall.id === opening.hostId);
	if (!host) return [];
	const symbol = openingSymbol(opening, host), stroke = props.selectedIds.includes(opening.id) ? props.tokens.accent : props.tokens.zoneStroke;
	const line = (points: readonly { x: number; y: number }[], width: number) => ({ points: points.flatMap(point => [point.x, point.y]), stroke, strokeWidth: width / props.zoom, lineCap: 'butt' });
	return [{ id: opening.id, cut: { ...line(symbol.cut, 1), stroke: props.tokens.canvasBackground, strokeWidth: host.thickness + 2 / props.zoom },
		frame: symbol.frame.map(points => line(points, 1.5)), leaf: line(symbol.leaf, 2), arc: line(symbol.arc, 1) }];
}));
</script>
<template>
	<VGroup
		v-for="symbol in symbols"
		:key="symbol.id"
		:config="{ name: symbol.id, listening: false }"
	>
		<VLine :config="symbol.cut" />
		<VLine
			v-for="(line, index) in symbol.frame"
			:key="index"
			:config="line"
		/>
		<VLine
			v-if="symbol.leaf.points.length"
			:config="symbol.leaf"
		/>
		<VLine
			v-if="symbol.arc.points.length"
			:config="symbol.arc"
		/>
	</VGroup>
</template>
