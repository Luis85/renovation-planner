<script setup lang="ts">
/**
 * §19's transient layer, filled by design slice 8: the in-progress polygon a drawing tool
 * broadcasts through `RenderState`, the calibration segment's ruler marks, and the selected
 * zone's body outline and vertex handles.
 *
 * **Still screen-space, and still `listening: false`.** Everything here works in stage
 * pixels: world points go through `worldToScreen` per recompute (a `computed`, so a camera
 * change re-projects and a pan does not), which is what keeps handles a constant size at
 * every zoom without Konva's per-node scale arithmetic. Hit-testing deliberately does NOT
 * happen here — `SelectTool` does its own geometry math against the same world points —
 * so an inert hit graph on this layer would be pure cost (SDD §62).
 *
 * The drawing tool's close target therefore lights up from GEOMETRY rather than from a Konva
 * `mouseover`: a layer that hears no pointer events cannot have a hover state of its own, so
 * it asks `closesPolygon` — the same predicate the tool's close click takes — of the pointer
 * the sketch carries, through `gestureGeometry.ts` rather than directly, since the asset
 * designer's own gesture layer asks the identical question. Asked per render rather than
 * stored by the tool, because a zoom moves the target under a pointer that has not moved.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import type { ThemeTokens } from '../theme/themeTokens';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';
import {
	POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX,
	POLYGON_CLOSE_TARGET_RADIUS_PX,
	POLYGON_VERTEX_RADIUS_PX,
	VERTEX_HANDLE_RADIUS_PX,
} from '../handleMetrics';
import { paintRulerMarks } from './rulerGeometry';
import { measurementScreenMarks, sketchScreenGeometry } from './gestureGeometry';
import RoomDraftSketch from './RoomDraftSketch.vue';

const props = defineProps<{ tokens: ThemeTokens }>();

const editorStore = useEditorStore();
const projectStore = useProjectStore();
const { zones } = storeToRefs(projectStore);
const { selectedIds } = storeToRefs(useSelectionStore());
const runtime = useEditorRuntime();

function toScreen(point: { x: number; y: number }) {
	return worldToScreen(point, editorStore.viewport, STAGE_PIXELS);
}

/**
 * A tool's rubber-band preview of a MOVE — `SelectTool`'s translated ghost of the zone
 * being dragged. Read through the reactive proxy over `RenderState`, so a tool's plain field
 * write re-renders this without any event wiring between tool and layer.
 */
const previewFlat = computed(() => {
	const preview = runtime.renderState.previewPolygon;
	if (preview === null || preview.length < 2) return null;
	return preview.flatMap((point) => {
		const at = toScreen(point);
		return [at.x, at.y];
	});
});

/** The sketch, projected once per render through the ONE module both surfaces share. */
const sketch = computed(() => sketchScreenGeometry(runtime.renderState.polygonSketch, toScreen));

/**
 * **The bars and every tick are ONE node, and that is a performance rule rather than a
 * tidiness one.** They were a `v-for` of `VLine`s — up to fifty of them at the tick cap —
 * so a Vue render and a vue-konva `setAttrs` ran per tick on EVERY pointer move, and this
 * gesture is nothing but pointer moves. Measured through the mounted rig in
 * `interactionLayer.test.ts`, the per-move cost tracked the NODE COUNT and nothing else:
 * 0.18 ms with no tool, 0.76 ms on a five-node segment, 2.61 ms at the 48-tick cap, against
 * 3.8 microseconds for `rulerMarks` itself. A user reported it as the calibration tool being
 * unusable, and the arithmetic — the obvious suspect, and the only part of this with its own
 * module — was 0.13% of it. Collapsing the marks onto one `Shape` took the same drag to
 * 0.83 ms and, which matters more, made it FLAT in the segment's length.
 *
 * The spine stays a `VLine` of its own. It is a single node that cannot grow, and it is what
 * `tests/helpers/planEditorRig.ts`'s `drawnLines` reads: folding it in would leave the
 * calibration cases in `canvasGestureOwnership` and `canvasKeyboardGestures` comparing two
 * empty arrays, which is the vacuous assertion this project keeps finding rather than a
 * saving.
 */
const measurementMarks = computed(() => measurementScreenMarks(runtime.renderState.measurement, toScreen));

/**
 * The hovered zone's outline (design slice 12) — `SelectTool.pointerMove`'s prediction of
 * what a click would take, drawn so the user sees it before they commit to it.
 *
 * `null` in every case that would say nothing new: no hover at all, a hover that IS the
 * selection (the selection outline below already draws it, thicker and solid — a second
 * outline on top would say nothing the first does not), and a hovered id the hydrated zones
 * no longer hold (the same "deleted while hovered, before refresh lands" case
 * `selectedScreenPoints` already guards below).
 */
const hoverOutlineFlat = computed(() => {
	const id = runtime.renderState.hoveredObjectId;
	if (id === null || selectedIds.value.some((selected) => String(selected) === id)) return null;
	const zone = zones.value.get(id);
	if (zone === undefined) return null;
	return zone.points.flatMap((point) => {
		const at = toScreen(point);
		return [at.x, at.y];
	});
});

/**
 * The selected zone's outline and vertex handles. Exactly one zone is selectable in this
 * slice (`SelectTool` sets one id); anything else renders nothing rather than guessing.
 */
const selectedScreenPoints = computed(() => {
	const ids = selectedIds.value;
	const id = ids.length === 1 ? ids.at(0) : undefined;
	if (id === undefined) return null;
	const zone = zones.value.get(id);
	if (zone === undefined) return null; // e.g. deleted while selected, before refresh lands
	return zone.points.map((point) => toScreen(point));
});

const selectedFlat = computed(() =>
	selectedScreenPoints.value === null
		? null
		: selectedScreenPoints.value.flatMap((at) => [at.x, at.y]),
);

/**
 * The first vertex is the close target, so it is drawn larger than the rest even at rest and
 * larger again while a click there would close the shape. All three sizes and the tolerance
 * that arms them live in `../handleMetrics.ts`, which is what keeps what the user SEES tied
 * to the region that ACTS — the pair of numbers this project has already had disagree once.
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
	<VLayer :config="{ name: 'interaction', listening: false }">
		<VLine
			v-if="previewFlat !== null"
			:config="{
				points: previewFlat,
				closed: true,
				stroke: props.tokens.accent,
				strokeWidth: 1.5,
				dash: [4, 4],
				strokeScaleEnabled: false,
				listening: false,
			}"
		/>
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
		<VLine
			v-if="hoverOutlineFlat !== null"
			:config="{
				name: 'hover-outline',
				points: hoverOutlineFlat,
				closed: true,
				stroke: props.tokens.accent,
				strokeWidth: 1,
				dash: [4, 4],
				strokeScaleEnabled: false,
				listening: false,
			}"
		/>
		<RoomDraftSketch
			:tokens="props.tokens"
			:to-screen="toScreen"
		/>
		<template v-if="selectedFlat !== null">
			<VLine
				:config="{
					name: 'selection-outline',
					points: selectedFlat,
					closed: true,
					stroke: props.tokens.accent,
					strokeWidth: 2,
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<VCircle
				v-for="(vertex, index) in selectedScreenPoints"
				:key="index"
				:config="{
					x: vertex.x,
					y: vertex.y,
					radius: VERTEX_HANDLE_RADIUS_PX,
					fill: props.tokens.canvasBackground,
					stroke: props.tokens.accent,
					strokeWidth: 1.5,
					listening: false,
				}"
			/>
		</template>
	</VLayer>
</template>
