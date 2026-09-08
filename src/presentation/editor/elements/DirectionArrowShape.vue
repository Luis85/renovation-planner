<script setup lang="ts">
import type { Point } from '../../../core/geometry/Point';
import type { ThemeTokens } from '../theme/themeTokens';
import { computed } from 'vue';
import { VERTEX_HANDLE_RADIUS_PX } from '../handleMetrics';
const props = defineProps<{ points: readonly Point[]; selected: boolean; tokens: ThemeTokens; zoom: number; editable?: boolean }>();
const stroke = computed(() => props.selected ? props.tokens.accent : props.tokens.zoneStroke);
</script>
<template>
	<VGroup :config="{ name: 'direction-arrow-native-shape', listening: false }">
		<VArrow
			v-if="points.length >= 2"
			:config="{ name: 'direction-arrow', points: points.flatMap(point => [point.x, point.y]), stroke, fill: stroke, strokeWidth: (selected ? 3 : 2) / zoom, pointerLength: 12 / zoom, pointerWidth: 10 / zoom }"
		/>
		<template v-if="editable">
			<VCircle
				v-for="(point, index) in points"
				:key="index"
				:config="{ name: 'arrow-endpoint', x: point.x, y: point.y, radius: VERTEX_HANDLE_RADIUS_PX / zoom, fill: tokens.canvasBackground, stroke, strokeWidth: 2 / zoom }"
			/>
		</template>
	</VGroup>
</template>
