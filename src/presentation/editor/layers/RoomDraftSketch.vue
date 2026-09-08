<script setup lang="ts">
import { computed } from 'vue';
import { useRoomDraftStore } from '../add/room-draft-store';
import type { ThemeTokens } from '../theme/themeTokens';
import type { Point } from '../../../core/geometry/Point';
import type { ScreenPoint } from '../viewport/Viewport';
const props = defineProps<{ tokens: ThemeTokens; toScreen: (point: Point) => ScreenPoint }>();
const draft = useRoomDraftStore();
// The template has one permanently mounted Group root, without sibling comments: a Fragment
// prevents vue-konva from resolving this component during the layer's child ordering pass.
const corners = computed(() => {
 const rect = draft.rect;
 return rect ? [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y },
  { x: rect.x + rect.width, y: rect.y + rect.depth }, { x: rect.x, y: rect.y + rect.depth }].map(props.toScreen) : [];
});
</script>
<template>
	<VGroup :config="{ name: 'room-draft-group', listening: false }">
		<template v-if="corners.length">
			<VLine :config="{ name: 'room-draft-fill', points: corners.flatMap(point => [point.x, point.y]), closed: true, fill: tokens.accent, opacity: 0.08, listening: false }" />
			<VLine :config="{ name: 'room-draft', points: corners.flatMap(point => [point.x, point.y]), closed: true, stroke: tokens.accent, strokeWidth: 1.5, listening: false }" />
			<VRect
				v-for="(point, index) in corners"
				:key="index"
				:config="{ name: 'room-draft-corner', x: point.x - 5, y: point.y - 5, width: 10, height: 10, stroke: tokens.accent, strokeWidth: 1.5, fill: tokens.canvasBackground, listening: false }"
			/>
		</template>
	</VGroup>
</template>
