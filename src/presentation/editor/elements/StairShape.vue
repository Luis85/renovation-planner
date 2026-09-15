<script setup lang="ts">
import { computed } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import { stairPlanGeometry, type StairOptions, type StairPlanGeometry } from '../../../domain/spatial/stairGeometry';
import type { ThemeTokens } from '../theme/themeTokens';
import type { ItemColor } from '../../../domain/spatial/ItemColor';
import { itemColorTint } from './itemColorAppearance';
const props = defineProps<{ points: readonly Point[]; options: StairOptions; selected: boolean; color?: ItemColor; tokens: ThemeTokens; zoom: number }>();
const geometry = computed<StairPlanGeometry | null>(() => stairPlanGeometry(props.points, props.options));
const stroke = computed(() => props.selected ? props.tokens.accent : props.tokens.zoneStroke);
const fill = computed(() => itemColorTint(props.color, props.tokens.canvasBackground));
const flat = (points: readonly Point[]) => points.flatMap(point => [point.x, point.y]);
</script>
<template>
	<VGroup :config="{ name: 'stair-native-shape', listening: false }">
		<template v-if="geometry">
			<VLine :config="{ name: 'stair-outline', points: flat(geometry.outline), closed: true, fill, stroke, strokeWidth: (selected ? 2 : 1) / zoom }" />
			<VLine
				v-for="(tread, index) in geometry.treads"
				:key="index"
				:config="{ name: 'stair-tread', points: flat(tread), stroke, strokeWidth: 1 / zoom, opacity: 0.6 }"
			/>
			<VArrow :config="{ name: 'stair-direction', points: flat(geometry.indicator), stroke, fill: stroke, strokeWidth: 1.5 / zoom, pointerLength: 8 / zoom, pointerWidth: 8 / zoom }" />
		</template>
	</VGroup>
</template>
