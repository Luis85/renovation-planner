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
 * That is also why the drawing tool's close target lights up from a FLAG rather than from a
 * Konva `mouseover`: a layer that hears no pointer events cannot have a hover state of its
 * own, so `DrawPolygonTool` decides it with the same camera-converted tolerance its close
 * click is judged by, and this layer draws what it is told.
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
import { rulerMarks } from './rulerGeometry';

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

/**
 * The polygon being drawn, projected once for both the outline and the vertex circles.
 *
 * The vertices the user has PLACED and the loose end their pointer is at are separate on
 * purpose (`RenderState.PolygonSketch`): every placed vertex gets a circle, and the pointer
 * gets none — a click that has landed and a mouse that happens to be somewhere are different
 * facts, and drawing them the same way is what made this gesture unreadable before.
 */
const sketchVertices = computed(() => {
	const sketch = runtime.renderState.polygonSketch;
	return sketch === null ? null : sketch.vertices.map((point) => toScreen(point));
});

/** The dashed outline: the placed vertices plus the loose end, when there is one. */
const sketchOutlineFlat = computed(() => {
	const sketch = runtime.renderState.polygonSketch;
	const vertices = sketchVertices.value;
	if (sketch === null || vertices === null) return null;
	const cursor = sketch.cursor === null ? [] : [toScreen(sketch.cursor)];
	const points = [...vertices, ...cursor];
	if (points.length < 2) return null;
	return points.flatMap((at) => [at.x, at.y]);
});

/** True while a click would CLOSE the polygon; the first vertex says so by growing. */
const closeArmed = computed(() => runtime.renderState.polygonSketch?.closeArmed === true);

/**
 * The calibration segment's marks: the spine, a perpendicular bar at each end and the ticks
 * along it, all from `rulerGeometry` so the arithmetic is testable without a canvas.
 *
 * Bars rather than the plain dots this drew until now, because a dot is where a vertex is
 * and a bar is where a measurement ENDS — the same reason the segment is solid and open
 * where a polygon preview is dashed and closed. Both endpoints project independently, for
 * the reason the whole layer works this way: screen space, so a zoom does not scale the
 * stroke or the marks.
 */
const measurementMarks = computed(() => {
	const segment = runtime.renderState.measurement;
	if (segment === null) return null;
	return rulerMarks(toScreen(segment.start), toScreen(segment.end));
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
	return closeArmed.value ? POLYGON_CLOSE_TARGET_HOVER_RADIUS_PX : POLYGON_CLOSE_TARGET_RADIUS_PX;
}

/** Filled while armed: colour is the second channel, size is the first (§85). */
function vertexFill(index: number): string {
	return index === 0 && closeArmed.value ? props.tokens.accent : props.tokens.canvasBackground;
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
		<template v-if="sketchVertices !== null">
			<VLine
				v-if="sketchOutlineFlat !== null"
				:config="{
					points: sketchOutlineFlat,
					closed: true,
					stroke: props.tokens.accent,
					strokeWidth: 1.5,
					dash: [4, 4],
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<VCircle
				v-for="(vertex, index) in sketchVertices"
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
			<VLine
				v-for="(bar, index) in measurementMarks.endBars"
				:key="`bar-${index}`"
				:config="{
					points: bar,
					stroke: props.tokens.accent,
					strokeWidth: 2,
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<VLine
				v-for="(tick, index) in measurementMarks.ticks"
				:key="`tick-${index}`"
				:config="{
					points: tick,
					stroke: props.tokens.accent,
					strokeWidth: 1,
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
		</template>
		<template v-if="selectedFlat !== null">
			<VLine
				:config="{
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
