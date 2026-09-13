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
import { samePoint, wallTangent, type Wall } from '../../../domain/spatial/Structure';
import { useDrawnStructure } from './drawnStructure';
import ElementShapes from '../elements/ElementShapes.vue';
import { draftCursorPoints, draftPreviewFields, isElementTool } from '../elements/elementDraft';
import { withElementPreviews } from '../elements/elementPreviews';
import { draftingKind } from '../../../domain/spatial/SpatialElement';
import WallDraftOverlay, { type WallCut } from './WallDraftOverlay.vue';
import { wallPasses } from './wallPasses';
import { useEditorStore } from '../../stores/EditorStore';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { wallPatterns } from './wallPatterns';
import { wallBodyPolygon } from './wallBody';
import { patternTile } from './patternTile';
import type { PlanPattern } from '../../../domain/asset/PlanPattern';
const props = defineProps<{ transform: NodeTransform; tokens: ThemeTokens; visible: boolean; zoom: number }>();
const project = useProjectStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const editor = useEditorStore();
const draftViewport = computed(() => ({ min: { x: -props.transform.x / props.zoom, y: -props.transform.y / props.zoom },
	max: { x: (editor.stageSize.width - props.transform.x) / props.zoom, y: (editor.stageSize.height - props.transform.y) / props.zoom } }));
const task = runtime.structureTask;
const structure = useDrawnStructure();
const points = (value: readonly Point[]): number[] => value.flatMap(p => [p.x, p.y]);
const wallPoints = (wall: Wall): number[] => points(arcPolyline({ ...wall, bulge: wall.bulge ?? 0 }, 0.25 / props.zoom));
const runs = computed(() => wallPasses(structure.value.walls, props.zoom));
const selected = (id: string): boolean => selection.selectedIds.some(candidate => candidate === id);
const previewPoints = computed(() => task.draft.points.length && task.draft.cursor ? points([task.draft.points[task.draft.points.length - 1], task.draft.cursor]) : []);
const noDraftPoints: readonly Point[] = [];
const wallDraftPoints = computed(() => runtime.activeToolId.value === 'draw-wall' ? task.draft.points : noDraftPoints);
const patterns = computed(() => wallPatterns(project.plan?.renovation ?? EMPTY_RENOVATION, runtime.planning.baseline.value?.catalogue ?? [], renovationSession.perspective === 'renovate' && renovationSession.mode === 'planned'));
const tiles = computed(() => new Map([...new Set(patterns.value.values())].map((pattern): [PlanPattern, HTMLCanvasElement | null] => [pattern, patternTile(pattern, props.tokens.wallPattern, props.tokens.wallFill)])));
const patterned = computed(() => structure.value.walls.flatMap(wall => {
	const pattern = patterns.value.get(wall.id), tile = pattern ? tiles.value.get(pattern) : null;
	return tile ? [{ id: wall.id, tile, points: wallBodyPolygon(wall, 0.25 / props.zoom).flatMap(point => [point.x, point.y]) }] : [];
}));
/**
 * Every cut the chain would make — its start and end joins and the join under the cursor — one
 * mark per distinct point. A start or pending join names a wall of the committed floor; an end
 * join may name a half that exists only in the drawn (pre-cut) structure, so the committed walls
 * are searched first (a cut wall keeps its id on the half that keeps its start, at the same offsets).
 */
const cuts = computed<readonly WallCut[]>(() => {
	if (runtime.activeToolId.value !== 'draw-wall') return [];
	const hosts = [...project.structure.walls, ...structure.value.walls];
	const marks = [task.draft.joins.start, task.draft.joins.end, task.draft.pending].filter((mark): mark is NonNullable<typeof mark> => mark !== null);
	return marks.flatMap(mark => hosts.filter(item => item.id === mark.wallId).slice(0, 1)
		.map(wall => ({ point: mark.point, tangent: wallTangent(wall, mark.offset), thickness: wall.thickness })))
		.filter((cut, index, all) => all.findIndex(other => samePoint(other.point, cut.point)) === index);
});
function handles(wall: Wall): readonly Point[] { return renovationSession.perspective !== 'review' && runtime.activeToolId.value !== 'edit-curves' && selected(wall.id) && selection.selectedIds.length === 1 ? [wall.start, wall.end] : []; }
const elementNames = computed(() => new Map(project.plan?.spatialElements?.map(item => [item.id, item.name])));
/** Posts, beams and every drafting mark but a hatch draw above the wall paint (see the elements block below); every other kind, a hatch included, draws below it. */
const drawsAboveWalls = (kind: string): boolean => kind === 'post' || kind === 'beam' || (draftingKind(kind) && kind !== 'hatch');
const elements = computed(() => withElementPreviews((structure.value.elements ?? []).filter(element => element.kind !== 'asset'), elementNames.value, runtime.rotationActions.preview.value, runtime.elementActions.preview.value, runtime.renderState.labelPreview));
const structuralElements = computed(() => elements.value.filter(element => drawsAboveWalls(element.kind)));
const nonStructuralElements = computed(() => elements.value.filter(element => !drawsAboveWalls(element.kind)));
const elementDraft = computed(() => {
	const draft = runtime.elementTask.draft;
	if (!isElementTool(runtime.activeToolId.value) || !draft.points.length) return [];
	return [{ id: 'element-preview', kind: draft.kind, name: draft.name, points: [...draft.points, ...draftCursorPoints(draft)], ...draftPreviewFields(draft) }];
});
const structuralElementDraft = computed(() => elementDraft.value.filter(element => drawsAboveWalls(element.kind)));
const nonStructuralElementDraft = computed(() => elementDraft.value.filter(element => !drawsAboveWalls(element.kind)));
</script>
<template>
	<VLayer :config="{ name: 'architecture', listening: false, visible, ...transform }">
		<!--
			Walls are drawn TWICE, and the two passes run over ALL runs rather than per run:
			every `wall-edge` (`zoneStroke`, `thickness + 2 / zoom`), then every `wall-body`
			(`wallFill`, `thickness`) over them, all opaque, so no joint doubles an alpha. What
			is left of the edge pass is a 1 px dark line along each side, M01's double-line wall.
			`wallPasses` chains walls meeting end to end (two at a joint, equally thick) into one
			run, so the mitre join draws that corner exactly at any angle, a closed loop included.
			Every other joint is where runs END: the pass ORDER closes its inner corner (run B's
			body covers run A's edge), and `wallPasses` carries both butt-capped passes past it,
			which closes the outer one: a T's stem until its far corner meets the host's far
			face, at any angle, so it never pokes through; any other shared end by the largest
			half thickness among the walls it JOINS (edge `1 / zoom` further); a free end gets
			only the edge's extra `1 / zoom`, its 1 px dark cap.
			Refused: `lineCap: 'square'` draws every free end `thickness / 2` too long.
			ponytail: two unequal walls meeting, or three with none straight through, are still
			capped rather than mitred: exact at a right angle, a small wedge or nub at any other;
			a stem thicker than its host at a shallow angle is pulled back behind the joint,
			leaving a notch on its own side. Canvas bevels a mitre sharper than about 11°
			(`miterLimit` 10). The selection dash and handles keep the unextended centreline.
			`OpeningSymbols` cuts both passes at the edge pass's width.

			A third, per-WALL pass fills a patterned wall's body with its material's hatch
			(ADR-0031). Per wall rather than per run, so the mitre wedge where two differently
			patterned walls meet stays plain — the spec's named gap.
		-->
		<!-- Every non-structural element (and its draft preview) draws before the wall paint, at
			the top of the layer, exactly as on `main` — an opaque object or stair fill would
			otherwise blank out any wall it overlaps, the common case since wall centre lines are
			snap candidates (final review finding F1). Posts and beams are the exception: see the
			comment below the wall-pattern pass. -->
		<ElementShapes
			:elements="nonStructuralElements"
			:editable="renovationSession.perspective === 'plan' && runtime.activeToolId.value === 'select'"
			:selected-ids="selection.selectedIds"
			:tokens="tokens"
			:zoom="zoom"
		/>
		<ElementShapes
			:elements="nonStructuralElementDraft"
			:selected-ids="['element-preview']"
			:tokens="tokens"
			:zoom="zoom"
		/>
		<VLine
			v-for="run in runs"
			:key="'edge-' + run.id"
			:config="{ name: 'wall-edge', points: run.edge, closed: run.closed, stroke: tokens.zoneStroke, strokeWidth: run.thickness + 2 / zoom, lineCap: 'butt', lineJoin: 'miter' }"
		/>
		<VLine
			v-for="run in runs"
			:key="'body-' + run.id"
			:config="{ name: 'wall-body', points: run.body, closed: run.closed, stroke: tokens.wallFill, strokeWidth: run.thickness, lineCap: 'butt', lineJoin: 'miter' }"
		/>
		<VLine
			v-for="item in patterned"
			:key="'pattern-' + item.id"
			:config="{ name: 'wall-pattern', points: item.points, closed: true, listening: false, fillPatternImage: item.tile, fillPatternRepeat: 'repeat', fillPatternScale: { x: 1 / zoom, y: 1 / zoom } }"
		/>
		<!-- Only posts, beams and drafting marks other than a hatch draw here, directly after the wall
			paint passes above (edge, body, pattern) and before the wall selection dash, endpoint
			handles, OpeningSymbols and the wall draft below, so a post standing in a wall (structural
			posts and beams design §5) is not painted over by the wall body that follows it, while the
			wall handles, openings and the in-progress wall draft still land on top of every element.
			Every other element kind draws before the wall paint instead (see above) — final review
			finding F1. -->
		<ElementShapes
			:elements="structuralElements"
			:editable="renovationSession.perspective === 'plan' && runtime.activeToolId.value === 'select'"
			:selected-ids="selection.selectedIds"
			:tokens="tokens"
			:zoom="zoom"
		/>
		<ElementShapes
			:elements="structuralElementDraft"
			:selected-ids="['element-preview']"
			:tokens="tokens"
			:zoom="zoom"
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
			:cuts="cuts"
			:tokens="tokens"
			:zoom="zoom"
		/>
	</VLayer>
</template>
