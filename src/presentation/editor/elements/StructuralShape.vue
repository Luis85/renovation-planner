<script setup lang="ts">
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { beamOutline } from '../../../domain/spatial/structuralElement';
import type { ThemeTokens } from '../theme/themeTokens';
const props = defineProps<{ element: SpatialElement; selected: boolean; tokens: ThemeTokens; zoom: number }>();
const flat = (points: readonly Point[]) => points.flatMap(point => [point.x, point.y]);
const stroke = computed(() => props.selected ? props.tokens.accent : props.tokens.zoneStroke);
/** Load-bearing reads heavier; a selection heavier again (structural posts and beams design §6). */
const weight = computed(() => (props.element.loadBearing ? 2 : 1) * (props.selected ? 1.5 : 1) / props.zoom);
/** A post: its outline, filled when load-bearing, with both diagonals — the plan symbol for a column. */
const post = computed(() => {
	const [a, b, c, d] = props.element.points;
	return props.element.kind === 'post' && d ? { outline: flat(props.element.points), diagonals: [flat([a, c]), flat([b, d])] } : null;
});
/** A beam: the two long edges of its band, dashed because it lies above the cut plane. */
const beamEdges = computed(() => {
	const band = props.element.kind === 'beam' && props.element.width ? beamOutline(props.element.points, props.element.width) : [];
	return band.length === 4 ? [flat([band[0], band[1]]), flat([band[3], band[2]])] : [];
});
</script>
<template>
	<VGroup :config="{ name: 'structural-native-shape', listening: false }">
		<template v-if="post">
			<VLine :config="{ name: 'post-outline', points: post.outline, closed: true, stroke, strokeWidth: weight, fill: element.loadBearing ? stroke : tokens.canvasBackground }" />
			<VLine
				v-for="(diagonal, index) in post.diagonals"
				:key="index"
				:config="{ name: 'post-diagonal', points: diagonal, stroke: element.loadBearing ? tokens.canvasBackground : stroke, strokeWidth: 1 / zoom }"
			/>
		</template>
		<VLine
			v-for="(edge, index) in beamEdges"
			:key="'beam-' + index"
			:config="{ name: 'beam-edge', points: edge, stroke, strokeWidth: weight, dash: [8 / zoom, 6 / zoom] }"
		/>
	</VGroup>
</template>
