<script setup lang="ts">
/**
 * §19's transient layer, filled by design slice 8: the in-progress polygon preview a
 * drawing tool broadcasts through `RenderState`, and the selected zone's body outline and
 * vertex handles.
 *
 * **Still screen-space, and still `listening: false`.** Everything here works in stage
 * pixels: world points go through `worldToScreen` per recompute (a `computed`, so a camera
 * change re-projects and a pan does not), which is what keeps handles a constant size at
 * every zoom without Konva's per-node scale arithmetic. Hit-testing deliberately does NOT
 * happen here — `SelectTool` does its own geometry math against the same world points —
 * so an inert hit graph on this layer would be pure cost (SDD §62).
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import type { ThemeTokens } from '../theme/themeTokens';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';
import { VERTEX_HANDLE_RADIUS_PX } from '../handleMetrics';

const props = defineProps<{ tokens: ThemeTokens }>();

const editorStore = useEditorStore();
const projectStore = useProjectStore();
const { zones } = storeToRefs(projectStore);
const { selectedIds } = storeToRefs(useSelectionStore());
const runtime = useEditorRuntime();

/**
 * The active tool's rubber-band preview, projected into stage pixels and flattened.
 * Read through the reactive proxy over `RenderState`, so a tool's plain field write
 * re-renders this without any event wiring between tool and layer.
 */
const previewFlat = computed(() => {
	const preview = runtime.renderState.previewPolygon;
	if (preview === null || preview.length < 2) return null;
	return preview.flatMap((point) => {
		const at = worldToScreen(point, editorStore.viewport, STAGE_PIXELS);
		return [at.x, at.y];
	});
});

/**
 * The calibration segment, projected the same way. SOLID and open, with a marker at each
 * end, deliberately unlike the dashed closed polygon above: the two say different things,
 * and a vault walkthrough found the calibration gesture drew nothing at all, so a user
 * clicking two points had no idea what the plugin thought they had picked.
 *
 * Both endpoints project independently rather than the segment being drawn as a two-point
 * polygon, for the reason the whole layer works this way — screen space, so a zoom does not
 * scale the stroke or the markers.
 */
const measurementEnds = computed(() => {
	const segment = runtime.renderState.measurement;
	if (segment === null) return null;
	return [segment.start, segment.end].map((point) =>
		worldToScreen(point, editorStore.viewport, STAGE_PIXELS),
	);
});

const measurementFlat = computed(() =>
	measurementEnds.value === null ? null : measurementEnds.value.flatMap((at) => [at.x, at.y]),
);

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
	return zone.points.map((point) => worldToScreen(point, editorStore.viewport, STAGE_PIXELS));
});

const selectedFlat = computed(() =>
	selectedScreenPoints.value === null
		? null
		: selectedScreenPoints.value.flatMap((at) => [at.x, at.y]),
);

// The drawn radius; `VERTEX_GRAB_RADIUS_PX` beside it is the region that grabs it. Both
// live in `../handleMetrics.ts` because they were declared independently here and in
// `select-tool.ts`, under the same name, with different values.
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
		<template v-if="measurementFlat !== null">
			<VLine
				:config="{
					points: measurementFlat,
					stroke: props.tokens.accent,
					strokeWidth: 2,
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<VCircle
				v-for="(end, index) in measurementEnds"
				:key="index"
				:config="{
					x: end.x,
					y: end.y,
					radius: VERTEX_HANDLE_RADIUS_PX,
					fill: props.tokens.canvasBackground,
					stroke: props.tokens.accent,
					strokeWidth: 1.5,
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
