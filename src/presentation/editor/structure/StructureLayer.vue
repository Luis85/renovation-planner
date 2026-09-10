<script setup lang="ts">
import { useRenovationSession } from '../renovation/renovationSession';
const renovationSession = useRenovationSession();
import { computed } from 'vue';
import type { ThemeTokens } from '../theme/themeTokens';
import type { NodeTransform } from '../viewport/Viewport';
import type { Point } from '../../../core/geometry/Point';
import { arcPolyline } from '../../../core/geometry/curvePolyline';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import OpeningSymbols from './OpeningSymbols.vue';
import { type Wall } from '../../../domain/spatial/Structure';
import { validateStructure } from '../../../domain/spatial/structureGeometry';
import { draftStructure, isStructureTool } from './structureDraft';
import ElementShapes from '../elements/ElementShapes.vue';
import { isElementTool } from '../elements/elementDraft';
import WallDraftOverlay from './WallDraftOverlay.vue';
import { useEditorStore } from '../../stores/EditorStore';
const props = defineProps<{ transform: NodeTransform; tokens: ThemeTokens; visible: boolean; zoom: number }>();
const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const editor = useEditorStore();
const draftViewport = computed(() => ({ min: { x: -props.transform.x / props.zoom, y: -props.transform.y / props.zoom },
	max: { x: (editor.stageSize.width - props.transform.x) / props.zoom, y: (editor.stageSize.height - props.transform.y) / props.zoom } }));
const task = runtime.structureTask;
const draftPreview = computed(() => {
	if (!isStructureTool(runtime.activeToolId.value)) return null;
	const proposed = draftStructure(task.draft, project.structure);
	if (!proposed || runtime.activeToolId.value === 'draw-wall') return proposed;
	return validateStructure(proposed, project.structure.boundaries.map(boundary => boundary.roomId)).ok ? proposed : null;
});
const structure = computed(() => runtime.curveTask.preview.value?.structure ?? runtime.groupActions?.preview.value?.structure ?? runtime.structureActions.preview.value ?? draftPreview.value ?? project.structure);
const points = (value: readonly Point[]): number[] => value.flatMap(p => [p.x, p.y]);
const wallPoints = (wall: Wall): number[] => points(arcPolyline({ ...wall, bulge: wall.bulge ?? 0 }, 0.25 / props.zoom));
const selected = (id: string): boolean => selection.selectedIds.some(candidate => candidate === id);
const previewPoints = computed(() => task.draft.points.length && task.draft.cursor ? points([task.draft.points[task.draft.points.length - 1], task.draft.cursor]) : []);
const noDraftPoints: readonly Point[] = [];
const wallDraftPoints = computed(() => runtime.activeToolId.value === 'draw-wall' ? task.draft.points : noDraftPoints);
function handles(wall: Wall): readonly Point[] { return renovationSession.perspective !== 'review' && runtime.activeToolId.value !== 'edit-curves' && selected(wall.id) && selection.selectedIds.length === 1 ? [wall.start, wall.end] : []; }
const elementNames = computed(() => new Map(project.plan?.spatialElements?.map(item => [item.id, item.name])));
const elements = computed(() => (structure.value.elements ?? []).map(element => runtime.rotationActions.preview.value?.id === element.id ? { ...element, name: runtime.rotationActions.preview.value.name, points: runtime.rotationActions.preview.value.points } : runtime.elementActions.preview.value?.id === element.id ? runtime.elementActions.preview.value : ({ ...element, name: elementNames.value.get(element.id) ?? element.id })));
const elementDraft = computed(() => {
	const draft = runtime.elementTask.draft;
	if (!isElementTool(runtime.activeToolId.value) || !draft.points.length) return [];
	const cursor = draft.cursor && (!['measurement', 'stair'].includes(draft.kind) || draft.points.length < 2) ? [draft.cursor] : [];
	return [{ id: 'element-preview', kind: draft.kind, name: draft.name, points: [...draft.points, ...cursor], ...(draft.kind === 'stair' ? { stair: draft.stair } : {}) }];
});
</script>
<template>
	<VLayer :config="{ name: 'architecture', listening: false, visible, ...transform }">
		<ElementShapes
			:elements="elements"
			:editable="renovationSession.perspective === 'plan' && runtime.activeToolId.value === 'select'"
			:selected-ids="selection.selectedIds"
			:tokens="tokens"
			:zoom="zoom"
		/>
		<ElementShapes
			:elements="elementDraft"
			:selected-ids="['element-preview']"
			:tokens="tokens"
			:zoom="zoom"
		/>
		<!--
			A wall is drawn TWICE, and the two passes run over ALL walls rather than per wall.
			Pass 1 is every wall as a `zoneStroke` stroke at `thickness + 2 / zoom`; pass 2 is
			every wall as a `wallFill` stroke at `thickness`, painted over it. What is left
			visible of pass 1 is a 1 px dark line along each side, which is the double-line
			wall M01 draws — and inside a joint, wall B's body covers wall A's edge, so a mitred
			corner falls out with no union, no offset polygons and no T-joint cases. The
			previous single stroke at `opacity: 0.65` doubled its alpha wherever two walls
			overlapped, which drew a dark square at every corner. A free wall end keeps a 1 px
			dark cap from pass 1: the architectural convention for a wall end, intended.
			`OpeningSymbols` below cuts through both passes with a `canvasBackground` stroke
			at `thickness + 2 / zoom`, the same width as pass 1.
		-->
		<VLine
			v-for="wall in structure.walls"
			:key="'edge-' + wall.id"
			:config="{ name: 'wall-edge', points: wallPoints(wall), stroke: tokens.zoneStroke, strokeWidth: wall.thickness + 2 / zoom, lineCap: 'butt', lineJoin: 'miter' }"
		/>
		<VLine
			v-for="wall in structure.walls"
			:key="'body-' + wall.id"
			:config="{ name: 'wall-body', points: wallPoints(wall), stroke: tokens.wallFill, strokeWidth: wall.thickness, lineCap: 'butt', lineJoin: 'miter' }"
		/>
		<VGroup
			v-for="wall in structure.walls"
			:key="wall.id"
			:config="{ name: wall.id }"
		>
			<VLine
				v-if="selected(wall.id) || runtime.openingMove.hostId.value === wall.id"
				:config="{ points: wallPoints(wall), stroke: tokens.accent, strokeWidth: 2 / zoom, dash: [7 / zoom, 4 / zoom] }"
			/>
			<VCircle
				v-for="(point, index) in handles(wall)"
				:key="index"
				:config="{ x: point.x, y: point.y, radius: 5 / zoom, stroke: tokens.zoneStroke, strokeWidth: 1 / zoom, fill: tokens.canvasBackground }"
			/>
		</VGroup>
		<OpeningSymbols
			:openings="structure.openings"
			:walls="structure.walls"
			:selected-ids="selection.selectedIds"
			:tokens="tokens"
			:zoom="zoom"
		/>
		<VLine
			v-if="previewPoints.length"
			:config="{ points: previewPoints, stroke: tokens.accent, strokeWidth: 2 / zoom, dash: [7 / zoom, 4 / zoom] }"
		/>
		<WallDraftOverlay
			:points="wallDraftPoints"
			:viewport="draftViewport"
			:cursor="runtime.activeToolId.value === 'draw-wall' ? task.draft.cursor : null"
			:tokens="tokens"
			:zoom="zoom"
		/>
	</VLayer>
</template>
