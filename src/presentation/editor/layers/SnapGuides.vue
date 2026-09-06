<script setup lang="ts">
import { computed } from 'vue';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { ThemeTokens } from '../theme/themeTokens';
import type { ToScreen } from './gestureGeometry';
const props = defineProps<{ guides: readonly LineSegment[]; toScreen: ToScreen; tokens: ThemeTokens }>();
const marks = computed(() => props.guides.map(guide => ({ start: props.toScreen(guide.start), end: props.toScreen(guide.end) })));
</script>
<template>
	<VGroup :config="{ listening: false }">
		<template
			v-for="(mark, index) in marks"
			:key="index"
		>
			<VLine :config="{ name: 'snap-guide', points: [mark.start.x, mark.start.y, mark.end.x, mark.end.y], stroke: tokens.accent, strokeWidth: 1, dash: [3, 3], listening: false }" />
			<VCircle :config="{ name: 'snap-target', x: mark.end.x, y: mark.end.y, radius: 5, stroke: tokens.accent, strokeWidth: 1.5, fill: tokens.canvasBackground, listening: false }" />
		</template>
	</VGroup>
</template>
