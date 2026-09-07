<script setup lang="ts">
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { ThemeTokens } from '../theme/themeTokens';
import { closedChain } from '../../../domain/spatial/structureGeometry';

const props = defineProps<{ points: readonly Point[]; tokens: ThemeTokens; zoom: number }>();
const corners = computed(() => closedChain(props.points) ? props.points.slice(0, -1) : props.points);
const line = computed(() => ({ name: 'wall-draft-outline', points: props.points.flatMap(point => [point.x, point.y]),
	stroke: props.tokens.accent, strokeWidth: 2 / props.zoom, dash: [6 / props.zoom, 3 / props.zoom], listening: false }));
</script>

<template>
	<VGroup :config="{ name: 'wall-draft', listening: false }">
		<VLine
			v-if="points.length > 1"
			:config="line"
		/>
		<VCircle
			v-for="(point, index) in corners"
			:key="index"
			:config="{ name: 'wall-draft-corner', x: point.x, y: point.y, radius: 4 / zoom,
				stroke: tokens.accent, strokeWidth: 2 / zoom, fill: tokens.canvasBackground, listening: false }"
		/>
	</VGroup>
</template>
