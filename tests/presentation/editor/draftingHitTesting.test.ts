// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { settle, settleUntil } from '../../helpers/editor';
import { editorWith, type EditorRig } from '../../helpers/structural';
import { pointerAt } from '../../helpers/tool-context';
import { BOUNDARY_A, DIMENSION_A, GRID_A, HATCH_A, SECTION_A, TEXT_A, VIEW_A } from '../../helpers/drafting';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { hasPointHandles } from '../../../src/presentation/editor/elements/ElementMove';
import { acceptsElementPoints } from '../../../src/presentation/editor/elements/elementDraft';
import { measureLabelWidth } from '../../../src/presentation/editor/labels/labelLayout';
import { DRAFTING_TEXT_PX, draftingHitContext, draftingHitPoints } from '../../../src/presentation/editor/elements/draftingMarks';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { worldToScreen, STAGE_PIXELS } from '../../../src/presentation/editor/viewport/Viewport';

const mounted: EditorRig[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });

it('hits a text across its drawn words and a grid point across its circle, at the zoom they are drawn at', () => {
	const structure = { ...EMPTY_STRUCTURE, elements: [TEXT_A, GRID_A] }, names = new Map([[TEXT_A.id, TEXT_A.name], [GRID_A.id, GRID_A.name]]);
	const at = (zoom: number, x: number, y: number) => resolveSelectionTarget({ candidates: structureCandidates(structure, undefined, { zoom, names }), selectedIds: [], worldPoint: { x, y }, handleToleranceWorld: 8 / zoom });
	const half = measureLabelWidth(TEXT_A.name, DRAFTING_TEXT_PX) / 2;
	expect(at(1, 1500 + half - 1, 1500)).toEqual({ kind: 'body', id: TEXT_A.id });
	expect(at(2, 1500 + half - 1, 1500)).toBeNull();
	expect(at(1, 7009, 0)).toEqual({ kind: 'body', id: GRID_A.id });
	expect(at(1, 7012, 0)).toBeNull();
	expect(structureCandidates(structure)[0].hitPoints).toBeUndefined();
});

it('hits a chain between its points and its line, a view marker at its triangle, a section along its line, a boundary and a hatch', () => {
	const structure = { ...EMPTY_STRUCTURE, elements: [DIMENSION_A, VIEW_A, SECTION_A, HATCH_A, BOUNDARY_A] };
	const candidates = structureCandidates(structure, undefined, { zoom: 1, names: new Map() });
	const at = (x: number, y: number) => resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x, y }, handleToleranceWorld: 8 });
	expect(at(2000, -300)).toEqual({ kind: 'body', id: DIMENSION_A.id });
	expect(at(2000, 300)).toBeNull();
	expect(at(-1500, 1005)).toEqual({ kind: 'body', id: VIEW_A.id });
	expect(at(3000, 2004)).toEqual({ kind: 'body', id: SECTION_A.id });
	expect(at(2000, -1250)).toEqual({ kind: 'body', id: BOUNDARY_A.id });
	expect(at(1500, 6000)).toEqual({ kind: 'body', id: HATCH_A.id });
});

it('ranks a hatch under the marks and walls drawn over it, and above only a room', () => {
	const words = { ...TEXT_A, points: [{ x: 1500, y: 6000 }] }, structure = { ...EMPTY_STRUCTURE, elements: [HATCH_A, words] };
	const room = { id: 'room', points: [{ x: -1000, y: 4000 }, { x: 4000, y: 4000 }, { x: 4000, y: 8000 }, { x: -1000, y: 8000 }] };
	const wall = { id: 'wall-across', kind: 'wall' as const, width: 200, points: [{ x: 2500, y: 4000 }, { x: 2500, y: 8000 }] };
	const candidates = [room, wall, ...structureCandidates(structure, undefined, { zoom: 1, names: new Map([[words.id, words.name]]) })];
	const at = (x: number, y: number) => resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x, y }, handleToleranceWorld: 8 });
	expect([at(1500, 6000), at(2500, 5500), at(500, 5500)]).toEqual([words.id, 'wall-across', HATCH_A.id].map(id => ({ kind: 'body', id })));
});

it('has no hit polygon for a chain whose first and last points coincide, nor for a mark with no points', () => {
	const context = draftingHitContext(1, undefined);
	expect(draftingHitPoints({ ...DIMENSION_A, points: [{ x: 500, y: 500 }, { x: 900, y: 500 }, { x: 500, y: 500 }] }, context)).toBeUndefined();
	expect(draftingHitPoints({ ...DIMENSION_A, points: [] }, context)).toBeUndefined();
	expect(draftingHitPoints({ ...GRID_A, points: [] }, context)).toBeUndefined();
});

it('gives drag handles to every drafting mark of more than one point, and refuses a hatch outline that crosses itself', () => {
	expect(['dimension', 'section', 'view', 'hatch', 'boundary'].every(kind => hasPointHandles(kind))).toBe(true);
	expect(['text', 'grid'].some(kind => hasPointHandles(kind))).toBe(false);
	expect(acceptsElementPoints(HATCH_A, [HATCH_A.points[0], HATCH_A.points[2], HATCH_A.points[1], HATCH_A.points[3]])).toBe(false);
});

it('keeps a dimension chain\'s offset when one of its points is dragged', async () => {
	const rig = await editorWith(mounted, DIMENSION_A);
	rig.selection.select([DIMENSION_A.id as never]); await settle();
	rig.runtime.toolManager.pointerDown(pointerAt(4560, 0)); rig.runtime.toolManager.pointerMove(pointerAt(4900, 150)); rig.runtime.toolManager.pointerUp(pointerAt(4900, 150));
	await settleUntil(() => rig.project.structure.elements?.[0].points[3].x !== 4560, 'dragged point saved');
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'dimension', offset: -600 });
});

it('keeps a section\'s look side when one of its points is dragged', async () => {
	const rig = await editorWith(mounted, SECTION_A);
	rig.selection.select([SECTION_A.id as never]); await settle();
	rig.runtime.toolManager.pointerDown(pointerAt(-1000, 2000)); rig.runtime.toolManager.pointerMove(pointerAt(-1000, 2300)); rig.runtime.toolManager.pointerUp(pointerAt(-1000, 2300));
	await settleUntil(() => rig.project.structure.elements?.[0].points[0].y !== 2000, 'dragged point saved');
	expect(rig.project.structure.elements?.[0]).toMatchObject({ kind: 'section', flipped: false });
});

it('right-clicks a text mark across its drawn words, not only its stored point, without clearing the selection', async () => {
	const rig = await editorWith(mounted, TEXT_A), editorStore = useEditorStore(rig.pinia);
	const half = measureLabelWidth(TEXT_A.name, DRAFTING_TEXT_PX) / editorStore.viewport.zoom / 2;
	const at = worldToScreen({ x: 1500 + half - 2, y: 1500 }, editorStore.viewport, STAGE_PIXELS), box = rig.canvasEl.getBoundingClientRect();
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: box.left + at.x, clientY: box.top + at.y }));
	await settle();
	expect(rig.selection.selectedIds).toEqual([TEXT_A.id]);
});

it('clicks a text mark through the same drafting context the tool uses, not only structureCandidates\'s own call', async () => {
	const rig = await editorWith(mounted, TEXT_A), editorStore = useEditorStore(rig.pinia);
	rig.selection.clear(); await settle();
	const half = measureLabelWidth(TEXT_A.name, DRAFTING_TEXT_PX) / editorStore.viewport.zoom / 2;
	rig.runtime.toolManager.pointerDown(pointerAt(1500 + half - 2, 1500)); rig.runtime.toolManager.pointerUp(pointerAt(1500 + half - 2, 1500));
	await settle();
	expect(rig.selection.selectedIds).toEqual([TEXT_A.id]);
});
