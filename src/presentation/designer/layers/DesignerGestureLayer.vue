<script setup lang="ts">
/**
 * The asset designer's transient layer: the outline being traced, the calibration tape being
 * measured, a box or circle detail being dragged out, the marquee rectangle a selection sweep
 * draws (AD08), and the guides a snapping gesture publishes — all read from the leaf's
 * `RenderState` and drawn in SCREEN space over every world-space layer.
 *
 * Every projection and the close-target rule come from `editor/layers/gestureGeometry.ts`,
 * and the drawing itself is `GestureSketch.vue` (finding E9) — the same component
 * `InteractionLayer.vue` mounts for the plan editor, as is `MarqueeOverlay.vue`: the marquee
 * rectangle is the same picture in both surfaces because it is the same field of the same
 * `RenderState`, and a designer copy of it would be a second answer to what a rubber band looks
 * like. Only this LAYER stays a copy: the plan
 * editor's also draws a selection and a translated ghost this surface has no subject for, so
 * the two templates diverge around the one they share. `listening: false` for the same reason
 * every designer layer says it — the tools hit-test world points themselves.
 *
 * It takes the `RenderState` as a PROP rather than injecting the runtime, so it can be mounted
 * standalone in the harness against a fixture and drawn there.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import type { Point } from '../../../core/geometry/Point';
import { useEditorStore } from '../../stores/EditorStore';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import type { RenderState } from '../../editor/tools/render-state';
import { STAGE_PIXELS, worldToScreen } from '../../editor/viewport/Viewport';
import GestureSketch from '../../editor/layers/GestureSketch.vue';
import MarqueeOverlay from '../../editor/layers/MarqueeOverlay.vue';
import SnapGuides from '../../editor/layers/SnapGuides.vue';
import { GESTURE_LAYER } from './backgroundLayer';

const props = defineProps<{ renderState: RenderState; tokens: ThemeTokens }>();

const { viewport } = storeToRefs(useEditorStore());

function toScreen(point: Point) {
	return worldToScreen(point, viewport.value, STAGE_PIXELS);
}

/**
 * A draw tool's in-flight detail (`DrawDetailTool`, and `DrawLineTool` since AD11), already
 * flattened in world space; projected here. Whether it CLOSES is `renderState.previewClosed` beside
 * it: an open line's preview must not draw an edge its write does not contain.
 */
const previewFlat = computed(
	() => props.renderState.previewPolygon?.flatMap((point) => {
		const at = toScreen(point);
		return [at.x, at.y];
	}) ?? null,
);
</script>

<template>
	<VLayer :config="{ name: GESTURE_LAYER, listening: false }">
		<GestureSketch
			:tokens="props.tokens"
			:to-screen="toScreen"
			:sketch="props.renderState.polygonSketch"
			:measurement="props.renderState.measurement"
		/>
		<VLine
			v-if="previewFlat !== null"
			:config="{
				name: 'detail-preview',
				points: previewFlat,
				closed: props.renderState.previewClosed,
				dash: [4, 4],
				stroke: props.tokens.accent,
				strokeWidth: 1.5,
				strokeScaleEnabled: false,
				listening: false,
			}"
		/>
		<MarqueeOverlay
			:bounds="props.renderState.marquee"
			:to-screen="toScreen"
			:tokens="props.tokens"
		/>
		<SnapGuides
			:guides="props.renderState.snapGuides"
			:to-screen="toScreen"
			:tokens="props.tokens"
		/>
	</VLayer>
</template>
