<script setup lang="ts">
import { computed } from 'vue';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import type { ScreenPoint } from '../viewport/Viewport';
import type { ThemeTokens } from '../theme/themeTokens';
const props = defineProps<{ bounds: BoundingBox | null; toScreen: (point: Point) => ScreenPoint; tokens: ThemeTokens }>();
const rectangle = computed(() => {
	if (!props.bounds) return null;
	const min = props.toScreen(props.bounds.min), max = props.toScreen(props.bounds.max);
	return { x: min.x, y: min.y, width: max.x - min.x, height: max.y - min.y, listening: false };
});
</script>
<template>
	<VGroup :config="{ name: 'marquee-overlay', listening: false }">
		<template v-if="rectangle">
			<VRect :config="{ ...rectangle, fill: tokens.accent, opacity: 0.08 }" />
			<VRect :config="{ ...rectangle, name: 'selection-marquee', stroke: tokens.accent, strokeWidth: 1.5, dash: [5, 3] }" />
		</template>
	</VGroup>
</template>
