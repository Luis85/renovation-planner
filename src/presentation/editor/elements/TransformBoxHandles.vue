<script setup lang="ts">
/**
 * The selected item's or placement's transform box (plan editor transform box design, Interaction): a
 * padded outline and eight handles in STAGE PIXELS, like every other handle on the `InteractionLayer`,
 * and `listening: false` — `SelectTool` hit tests the same `transformHandlePoints`. Hidden while that
 * element's own move or resize preview is up and while anything rotates; mounted before the rotation
 * arrow, which paints above it and is hit tested before it.
 */
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useEditorStore } from '../../stores/EditorStore';
import type { ThemeTokens } from '../theme/themeTokens';
import { STAGE_PIXELS, worldPerScreenPixel, worldToScreen } from '../viewport/Viewport';
import { TRANSFORM_HANDLE_SIZE_PX, VERTEX_GRAB_RADIUS_PX } from '../handleMetrics';
import { transformHandlePoints } from './transformBox';

const props = defineProps<{ tokens: ThemeTokens }>();
const runtime = useEditorRuntime(), editor = useEditorStore();
const drawn = computed(() => {
	const frame = runtime.elementActions.transformBox.value;
	if (!frame || runtime.elementActions.preview.value?.id === frame.element.id || runtime.renderState.rotationInteraction !== null) return null;
	const worldPerPixel = worldPerScreenPixel(editor.viewport, STAGE_PIXELS), world = transformHandlePoints(frame, worldPerPixel), pointer = editor.pointerWorld;
	const hovered = runtime.renderState.hoveredTargetKind === 'resize' && pointer !== null
		? world.findIndex(point => Math.hypot(point.x - pointer.x, point.y - pointer.y) <= VERTEX_GRAB_RADIUS_PX * worldPerPixel) : -1;
	const screen = world.map(point => worldToScreen(point, editor.viewport, STAGE_PIXELS));
	return {
		outline: [0, 2, 4, 6].flatMap(index => [screen[index].x, screen[index].y]),
		squares: screen.map((at, index) => ({ x: at.x - TRANSFORM_HANDLE_SIZE_PX / 2, y: at.y - TRANSFORM_HANDLE_SIZE_PX / 2, hovered: index === hovered })),
	};
});
</script>

<template>
	<VGroup
		v-if="drawn"
		:config="{ name: 'transform-box', listening: false }"
	>
		<VLine
			:config="{
				name: 'transform-box-outline',
				points: drawn.outline,
				closed: true,
				stroke: props.tokens.accent,
				strokeWidth: 1,
				dash: [4, 3],
				listening: false,
			}"
		/>
		<VRect
			v-for="(square, index) in drawn.squares"
			:key="index"
			:config="{
				name: 'transform-box-handle',
				x: square.x,
				y: square.y,
				width: TRANSFORM_HANDLE_SIZE_PX,
				height: TRANSFORM_HANDLE_SIZE_PX,
				fill: square.hovered ? props.tokens.accent : props.tokens.canvasBackground,
				stroke: props.tokens.accent,
				strokeWidth: 1.5,
				listening: false,
			}"
		/>
	</VGroup>
</template>
