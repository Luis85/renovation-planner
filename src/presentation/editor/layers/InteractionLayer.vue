<script setup lang="ts">
import { useRenovationSession } from '../renovation/renovationSession';
const renovationSession = useRenovationSession();
/**
 * §19's transient layer, filled by design slice 8: the in-progress polygon a drawing tool
 * broadcasts through `RenderState`, the calibration segment's ruler marks, and the selected
 * zone's body outline and vertex handles — or, for a multi-selection, one numbered outline per
 * selected zone and no handles, since nothing here edits a group.
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
 *
 * **The sketch and the measurement tape are `GestureSketch.vue` now** (finding E9): this layer
 * and `DesignerGestureLayer.vue` fed the identical template from `RenderState`/props of their
 * own, and that shared half is extracted into one `<VGroup>`-rooted component, mounted here
 * unconditionally exactly as `RoomDraftSketch` already is beside it — see that component's own
 * docblock for the vue-konva reindex hazard a fragment root would reintroduce.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import type { ThemeTokens } from '../theme/themeTokens';
import { STAGE_PIXELS, worldToScreen, viewportTransform } from '../viewport/Viewport';
import { SELECTION_BADGE_RADIUS_PX, VERTEX_HANDLE_RADIUS_PX } from '../handleMetrics';
import RoomDraftSketch from './RoomDraftSketch.vue';
import MarqueeOverlay from './MarqueeOverlay.vue';
import { structureCandidates } from '../structure/structureCandidates';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import GestureSketch from './GestureSketch.vue';
import ObjectRotationHandle from '../elements/ObjectRotationHandle.vue';
import SnapGuides from './SnapGuides.vue';
import { spatialOutlinePoints } from '../selection/spatialOutlinePoints';
import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import CurveHandles from '../curves/CurveHandles.vue';

const props = defineProps<{ tokens: ThemeTokens }>();

const editorStore = useEditorStore();
const projectStore = useProjectStore();
const { zones } = storeToRefs(projectStore);
const runtime = useEditorRuntime();
const candidates = computed(() => {
	const preview = runtime.curveTask.preview.value ?? runtime.groupActions?.preview.value, objects = new Map(preview?.objects.map(object => [object.id, object]));
	return new Map<string, SpatialObjectCandidate>([...[...zones.value].map(([id, zone]) => [id, { ...zone, ...objects.get(id) }] as const),
		...structureCandidates(preview?.structure ?? projectStore.structure).map(item => [item.id, item] as const)]);
});
const { selectedIds, focusedId } = storeToRefs(useSelectionStore());

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
	const selected = selectedIds.value.length === 1 ? zones.value.get(selectedIds.value[0]) : undefined;
	return polygonPolyline({ points: preview, bulges: selected?.bulges }, 0.25 / viewportTransform(editorStore.viewport).scaleX).flatMap((point) => {
		const at = toScreen(point);
		return [at.x, at.y];
	});
});

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
	const zone = candidates.value.get(id);
	if (zone === undefined) return null;
	return spatialOutlinePoints(zone, 0.25 / viewportTransform(editorStore.viewport).scaleX).flatMap((point) => {
		const at = toScreen(point);
		return [at.x, at.y];
	});
});
const hoverClosed = computed(() => {
	// The one reader is the hover outline's `:config`, inside `v-if="hoverOutlineFlat !== null"`,
	// and `hoverOutlineFlat` answers null for a null `hoveredObjectId`: the id is set whenever the
	// template evaluates this.
	const kind = candidates.value.get(runtime.renderState.hoveredObjectId as string)?.kind;
	return kind === undefined || kind === 'object' || kind === 'stair';
});

/**
 * Vertex handles belong to a single selection. Multiple selections use numbered outlines.
 */
const selectedGeometry = computed(() => {
	const ids = selectedIds.value;
	const id = ids.length === 1 ? ids.at(0) : undefined;
	if (id === undefined) return null;
	const zone = zones.value.get(id);
	if (zone === undefined) return null; // e.g. deleted while selected, before refresh lands
	return candidates.value.get(id) ?? zone;
});
const selectedScreenPoints = computed(() => selectedGeometry.value?.points.map(point => toScreen(point)) ?? null);

const selectedFlat = computed(() => {
	const geometry = selectedGeometry.value;
	return geometry ? polygonPolyline(geometry, 0.25 / viewportTransform(editorStore.viewport).scaleX).flatMap(point => { const at = toScreen(point); return [at.x, at.y]; }) : null;
});

/** Multiple selections show all outlines, without handles suggesting a group edit. */
const multiOutlines = computed(() => selectedIds.value.length < 2 ? [] : selectedIds.value.flatMap((id) => {
	const zone = candidates.value.get(id);
	return zone === undefined ? [] : [{
		id,
		closed: zone.kind === undefined || zone.kind === 'object' || zone.kind === 'stair',
		number: selectedIds.value.indexOf(id) + 1,
		anchor: zone.points.length > 0 ? toScreen(zone.points[0]) : null,
		strokeWidth: focusedId.value === id ? 3 : 2,
		badgeStrokeWidth: focusedId.value === id ? 3 : 1.5,
		points: spatialOutlinePoints(zone, 0.25 / viewportTransform(editorStore.viewport).scaleX).flatMap((point) => {
			const at = toScreen(point);
			return [at.x, at.y];
		}),
	}];
}));

/** Room outlines stay editable in Plan and Renovate; Review draws no editing handles. */
const editableVertices = computed(() => renovationSession.perspective !== 'review' && runtime.activeToolId.value !== 'edit-curves' ? selectedScreenPoints.value : []);
</script>

<template>
	<VLayer :config="{ name: 'interaction', listening: false }">
		<VLine
			v-if="previewFlat !== null"
			:config="{
				name: 'geometry-preview',
				points: previewFlat,
				closed: true,
				stroke: props.tokens.accent,
				strokeWidth: 1.5,
				dash: [4, 4],
				strokeScaleEnabled: false,
				listening: false,
			}"
		/>
		<SnapGuides
			:guides="runtime.renderState.snapGuides"
			:to-screen="toScreen"
			:tokens="props.tokens"
		/>
		<GestureSketch
			:tokens="props.tokens"
			:to-screen="toScreen"
			:sketch="runtime.renderState.polygonSketch"
			:measurement="runtime.renderState.measurement"
		/>
		<VLine
			v-if="hoverOutlineFlat !== null"
			:config="{
				name: 'hover-outline',
				points: hoverOutlineFlat,
				closed: hoverClosed,
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
		<MarqueeOverlay
			:bounds="runtime.renderState.marquee"
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
				v-for="(vertex, index) in editableVertices"
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
		<template
			v-for="outline in multiOutlines"
			:key="outline.id"
		>
			<VLine
				:config="{
					name: 'selection-outline',
					points: outline.points,
					closed: outline.closed,
					stroke: props.tokens.accent,
					strokeWidth: outline.strokeWidth,
					strokeScaleEnabled: false,
					listening: false,
				}"
			/>
			<template v-if="outline.anchor !== null">
				<VCircle
					:config="{
						name: 'selection-badge',
						x: outline.anchor.x, y: outline.anchor.y,
						radius: SELECTION_BADGE_RADIUS_PX,
						fill: props.tokens.canvasBackground,
						stroke: props.tokens.accent,
						strokeWidth: outline.badgeStrokeWidth,
						listening: false,
					}"
				/>
				<VText
					:config="{
						x: outline.anchor.x - SELECTION_BADGE_RADIUS_PX,
						y: outline.anchor.y - 6,
						width: SELECTION_BADGE_RADIUS_PX * 2,
						text: String(outline.number), fontSize: 12, align: 'center',
						fill: props.tokens.zoneLabel, listening: false,
					}"
				/>
			</template>
		</template>
		<VGroup :config="{ name: 'rotation-handle-viewport', ...viewportTransform(editorStore.viewport) }">
			<CurveHandles
				v-if="runtime.curveTask.target.value"
				:tokens="props.tokens"
				:zoom="editorStore.viewport.zoom"
			/>
			<ObjectRotationHandle
				:tokens="props.tokens"
				:zoom="editorStore.viewport.zoom"
			/>
		</VGroup>
	</VLayer>
</template>
