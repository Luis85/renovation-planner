<script setup lang="ts">
/**
 * The asset designer's transient layer: the footprint or clearance being traced, and the
 * calibration tape being measured, read from the leaf's `RenderState` and drawn in SCREEN
 * space over the four world-space layers.
 *
 * Every projection and the close-target rule come from `editor/layers/gestureGeometry.ts`,
 * and the drawing itself is `GestureSketch.vue` (finding E9) — the same component
 * `InteractionLayer.vue` mounts for the plan editor. Only this LAYER stays a copy: the plan
 * editor's also draws a selection and a translated ghost this surface has no subject for, so
 * the two templates diverge around the one they share. `listening: false` for the same reason
 * every designer layer says it — the tools hit-test world points themselves.
 *
 * It takes the `RenderState` as a PROP rather than injecting the runtime, so it can be mounted
 * standalone in the harness against a fixture and drawn there.
 */
import { storeToRefs } from 'pinia';
import type { Point } from '../../../core/geometry/Point';
import { useEditorStore } from '../../stores/EditorStore';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import type { RenderState } from '../../editor/tools/render-state';
import { STAGE_PIXELS, worldToScreen } from '../../editor/viewport/Viewport';
import GestureSketch from '../../editor/layers/GestureSketch.vue';
import { GESTURE_LAYER } from './backgroundLayer';

const props = defineProps<{ renderState: RenderState; tokens: ThemeTokens }>();

const { viewport } = storeToRefs(useEditorStore());

function toScreen(point: Point) {
	return worldToScreen(point, viewport.value, STAGE_PIXELS);
}
</script>

<template>
	<VLayer :config="{ name: GESTURE_LAYER, listening: false }">
		<GestureSketch
			:tokens="props.tokens"
			:to-screen="toScreen"
			:sketch="props.renderState.polygonSketch"
			:measurement="props.renderState.measurement"
		/>
	</VLayer>
</template>
