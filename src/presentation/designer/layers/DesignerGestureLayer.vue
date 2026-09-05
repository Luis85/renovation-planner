<script setup lang="ts">
/**
 * The asset designer's transient layer: the footprint or clearance being traced, and the
 * calibration tape being measured, read from the leaf's `RenderState` and drawn in SCREEN
 * space over the four world-space layers.
 *
 * Every projection and the close-target rule come from `editor/layers/gestureGeometry.ts`,
 * which `InteractionLayer.vue` calls for the plan editor; only the template lives twice,
 * because the plan editor's also draws a selection and a translated ghost this surface has
 * no subject for. `listening: false` for the same reason every designer layer says it — the
 * tools hit-test world points themselves.
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
import {
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
} from '../../editor/handleMetrics';
import { paintRulerMarks } from '../../editor/layers/rulerGeometry';
import { measurementScreenMarks, sketchScreenGeometry } from '../../editor/layers/gestureGeometry';
import { GESTURE_LAYER } from './backgroundLayer';

const props = defineProps<{ renderState: RenderState; tokens: ThemeTokens }>();

const { viewport } = storeToRefs(useEditorStore());

function toScreen(point: Point) {
	return worldToScreen(point, viewport.value, STAGE_PIXELS);
}

const sketch = computed(() => sketchScreenGeometry(props.renderState.polygonSketch, toScreen));
const measurementMarks = computed(() => measurementScreenMarks(props.renderState.measurement, toScreen));

function vertexRadius(index: number): number {
	if (index !== 0) return POLYGON_VERTEX_RADIUS_PX;
	return sketch.value?.closeArmed === true ? POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX : POLYGON_CLOSE_TARGET_RADIUS_PX;
}

function vertexFill(index: number): string {
	return index === 0 && sketch.value?.closeArmed === true ? props.tokens.accent : props.tokens.canvasBackground;
}
</script>

<template>
	<!--
		REVIEWED CLONE with `InteractionLayer.vue`'s own sketch and measurement blocks. The two
		layers draw the same gesture visuals over the same `gestureGeometry` projections and the
		same close-target rule, which is deliberate — that shared half is already three shared
		modules (`gestureGeometry.ts`, `closeTarget.ts`, `handleMetrics.ts`).

		What is left is the vue-konva TEMPLATE, and extracting it into a child component is
		refused on a defect this repository has already paid for: vue-konva reindexes on the
		LAYER's `onUpdated`, and Vue runs a parent's update job before its child's, so a
		fragment-rooted child does not enter the layer's ordering array in the pass that
		reindexes it — the z-order defect whose fix was to mount a `VGroup` UNCONDITIONALLY with
		the `v-if` inside it. A shared component reintroduces exactly that shape, in the layer
		where draw order decides what the user can see.
	-->
	<!-- fallow-ignore-next-line code-duplication -->
	<VLayer :config="{ name: GESTURE_LAYER, listening: false }">
		<template v-if="sketch !== null">
			<VLine
				v-if="sketch.outlineFlat !== null"
				:config="{
					points: sketch.outlineFlat,
					closed: true,
					stroke: props.tokens.accent,
					strokeWidth: 1.5,
					dash: [4, 4],
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<VCircle
				v-for="(vertex, index) in sketch.vertices"
				:key="index"
				:config="{
					x: vertex.x,
					y: vertex.y,
					radius: vertexRadius(index),
					fill: vertexFill(index),
					stroke: props.tokens.accent,
					strokeWidth: 1.5,
					listening: false,
				}"
			/>
		</template>
		<template v-if="measurementMarks !== null">
			<VLine
				:config="{
					points: measurementMarks.spine,
					stroke: props.tokens.accent,
					strokeWidth: 2,
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<VShape
				:config="{
					name: 'measurement-marks',
					marks: measurementMarks,
					sceneFunc: paintRulerMarks,
					stroke: props.tokens.accent,
					strokeScaleEnabled: false,
					perfectDrawEnabled: false,
					listening: false,
				}"
			/>
		</template>
	</VLayer>
</template>
