<script setup lang="ts">
/**
 * The in-progress polygon sketch and the calibration tape, drawn once for both editing
 * surfaces (finding E9). `InteractionLayer.vue` (the Plan Editor) and `DesignerGestureLayer.vue`
 * (the asset designer) each fed the identical vue-konva template from the identical
 * `gestureGeometry.ts` projections and the identical close-target rule; what differed was
 * never the drawing, only which store or prop the surface reads its `RenderState` from.
 * `DesignerGestureLayer.vue`'s own `fallow-ignore-next-line code-duplication` named that clone
 * and refused to extract it on a hazard this component exists to answer.
 *
 * **The single `<VGroup>` root, always mounted, is what makes this extractable at all** — the
 * same correctness requirement `RoomDraftSketch.vue:158` states in full and `ZoneShape.vue`
 * carries a second time for a sibling case. vue-konva orders a layer's children by walking the
 * LAYER's own subtree and resolving each vnode to a Konva node, then `setZIndex`ing them in that
 * order; a component whose root is a FRAGMENT resolves to `null` and its nodes never enter that
 * array. A `<VGroup>` root IS resolvable, so it takes this component's place in the layer's
 * ordering at the position the caller mounts it — which is what the two hand-written copies
 * could not risk giving up before this shape existed. The group carries no `v-if` of its own,
 * because the reindex runs on the LAYER's `onUpdated` and a group created later would be
 * appended after that pass already ran; the `v-if`s that gate the sketch and the measurement
 * live on its CHILDREN instead, exactly as both call sites already had them.
 */
import { computed } from 'vue';
import type { ThemeTokens } from '../theme/themeTokens';
import {
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
} from '../handleMetrics';
import { paintRulerMarks } from './rulerGeometry';
import { measurementScreenMarks, sketchScreenGeometry, type ToScreen } from './gestureGeometry';
import type { PolygonSketch } from '../tools/render-state';
import type { LineSegment } from '../../../core/geometry/LineSegment';

const props = defineProps<{
	tokens: ThemeTokens;
	toScreen: ToScreen;
	sketch: PolygonSketch | null;
	measurement: LineSegment | null;
}>();

const sketch = computed(() => sketchScreenGeometry(props.sketch, props.toScreen));

/**
 * **The bars and every tick are ONE node, and that is a performance rule rather than a
 * tidiness one.** They were a `v-for` of `VLine`s — up to fifty of them at the tick cap — so a
 * Vue render and a vue-konva `setAttrs` ran per tick on EVERY pointer move, and this gesture is
 * nothing but pointer moves. Measured through the mounted rig in `interactionLayer.test.ts`,
 * the per-move cost tracked the NODE COUNT and nothing else: 0.18 ms with no tool, 0.76 ms on a
 * five-node segment, 2.61 ms at the 48-tick cap, against 3.8 microseconds for `rulerMarks`
 * itself. A user reported it as the calibration tool being unusable, and the arithmetic — the
 * obvious suspect, and the only part of this with its own module — was 0.13% of it. Collapsing
 * the marks onto one `Shape` took the same drag to 0.83 ms and, which matters more, made it
 * FLAT in the segment's length.
 *
 * The spine stays a `VLine` of its own. It is a single node that cannot grow, and it is what
 * `tests/helpers/planEditorRig.ts`'s `drawnLines` reads: folding it in would leave the
 * calibration cases in `canvasGestureOwnership` and `canvasKeyboardGestures` comparing two
 * empty arrays, which is the vacuous assertion this project keeps finding rather than a saving.
 */
const measurementMarks = computed(() => measurementScreenMarks(props.measurement, props.toScreen));

/**
 * The first vertex is the close target, so it is drawn larger than the rest even at rest and
 * larger again while a click there would close the shape. All three sizes and the tolerance
 * that arms them live in `../handleMetrics.ts`, which is what keeps what the user SEES tied to
 * the region that ACTS — the pair of numbers this project has already had disagree once.
 */
function vertexRadius(index: number): number {
	if (index !== 0) return POLYGON_VERTEX_RADIUS_PX;
	return sketch.value?.closeArmed === true ? POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX : POLYGON_CLOSE_TARGET_RADIUS_PX;
}

/** Filled while armed: colour is the second channel, size is the first (§85). */
function vertexFill(index: number): string {
	return index === 0 && sketch.value?.closeArmed === true ? props.tokens.accent : props.tokens.canvasBackground;
}
</script>

<template>
	<VGroup :config="{ name: 'gesture-sketch', listening: false }">
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
	</VGroup>
</template>
