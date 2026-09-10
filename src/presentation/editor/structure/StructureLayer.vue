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
import { wallPasses } from './wallPasses';
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
const passes = computed(() => structure.value.walls.map(wall => wallPasses(wall, structure.value.walls, props.zoom)));
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
			A wall is drawn TWICE, and the two passes run over ALL walls rather than per wall:
			every `wall-edge` (`zoneStroke`, `thickness + 2 / zoom`), then every `wall-body`
			(`wallFill`, `thickness`) over them, all opaque, so no joint doubles an alpha. What
			is left of the edge pass is a 1 px dark line along each side, M01's double-line wall.
			The pass ORDER closes a joint's inner corner: wall B's body covers wall A's edge.
			Both passes are butt-capped, so `wallPasses` carries each past a SHARED endpoint
			(body `thickness / 2`, edge `1 / zoom` further), which closes the OUTER corner; a
			free end gets only the edge's extra `1 / zoom`, its 1 px dark cap.
			Refused: `lineCap: 'square'` draws every free end `thickness / 2` too long.
			Refused: chaining walls into mitred polylines is exact at any angle, but more code.
			ponytail: exact at right-angle joints; a non-right joint leaves a small wedge or nub.
			Chain the walls if that shows. The selection dash and handles keep the unextended
			centreline. `OpeningSymbols` cuts both passes at the edge pass's width.
		-->
		<VLine
			v-for="(wall, index) in structure.walls"
			:key="'edge-' + wall.id"
			:config="{ name: 'wall-edge', points: passes[index].edge, stroke: tokens.zoneStroke, strokeWidth: wall.thickness + 2 / zoom, lineCap: 'butt', lineJoin: 'miter' }"
		/>
		<VLine
			v-for="(wall, index) in structure.walls"
			:key="'body-' + wall.id"
			:config="{ name: 'wall-body', points: passes[index].body, stroke: tokens.wallFill, strokeWidth: wall.thickness, lineCap: 'butt', lineJoin: 'miter' }"
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
