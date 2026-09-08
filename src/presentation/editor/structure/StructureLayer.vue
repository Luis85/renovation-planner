<script setup lang="ts">
import { useRenovationSession } from '../renovation/renovationSession';
const renovationSession = useRenovationSession();
import { computed } from 'vue';
import type { ThemeTokens } from '../theme/themeTokens';
import type { NodeTransform } from '../viewport/Viewport';
import type { Point } from '../../../core/geometry/Point';
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
const structure = computed(() => runtime.groupActions?.preview.value?.structure ?? runtime.structureActions.preview.value ?? draftPreview.value ?? project.structure);
const points = (value: readonly Point[]): number[] => value.flatMap(p => [p.x, p.y]);
const selected = (id: string): boolean => selection.selectedIds.some(candidate => candidate === id);
const previewPoints = computed(() => task.draft.points.length && task.draft.cursor ? points([task.draft.points[task.draft.points.length - 1], task.draft.cursor]) : []);
const noDraftPoints: readonly Point[] = [];
const wallDraftPoints = computed(() => runtime.activeToolId.value === 'draw-wall' ? task.draft.points : noDraftPoints);
function handles(wall: Wall): readonly Point[] { return renovationSession.perspective !== 'review' && selected(wall.id) && selection.selectedIds.length === 1 ? [wall.start, wall.end] : []; }
const elementNames = computed(() => new Map(project.plan?.spatialElements?.map(item => [item.id, item.name])));
const elements = computed(() => (structure.value.elements ?? []).map(element => runtime.rotationActions.preview.value?.id === element.id ? { ...element, name: runtime.rotationActions.preview.value.name, points: runtime.rotationActions.preview.value.points } : runtime.elementActions.preview.value?.id === element.id ? runtime.elementActions.preview.value : ({ ...element, name: elementNames.value.get(element.id) ?? element.id })));
const elementDraft = computed(() => {
	const draft = runtime.elementTask.draft;
	if (!isElementTool(runtime.activeToolId.value) || !draft.points.length) return [];
	const cursor = draft.cursor && (draft.kind !== 'measurement' || draft.points.length < 2) ? [draft.cursor] : [];
	return [{ id: 'element-preview', kind: draft.kind, name: draft.name, points: [...draft.points, ...cursor] }];
});
</script>
<template>
	<VLayer :config="{ name: 'architecture', listening: false, visible, ...transform }">
		<ElementShapes
			:elements="elements"
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
		<VGroup
			v-for="wall in structure.walls"
			:key="wall.id"
			:config="{ name: wall.id }"
		>
			<VLine :config="{ points: points([wall.start, wall.end]), stroke: tokens.zoneStroke, strokeWidth: wall.thickness, opacity: 0.65 }" />
			<VLine
				v-if="selected(wall.id)"
				:config="{ points: points([wall.start, wall.end]), stroke: tokens.accent, strokeWidth: 2 / zoom, dash: [7 / zoom, 4 / zoom] }"
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
