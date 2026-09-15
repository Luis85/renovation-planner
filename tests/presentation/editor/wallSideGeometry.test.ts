import { expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { expectDefined } from '../../helpers/domain';
import type { Structure, Wall } from '../../../src/domain/spatial/Structure';
import { resizeWallTotal, wallSideAt, wallSnapReach } from '../../../src/domain/spatial/wallSides';
import { openingCutPolygon, openingSymbol } from '../../../src/domain/spatial/openingGeometry';
import { createWallSideDraft } from '../../../src/presentation/editor/structure/wallSideDraft';
import { parseExtentMetres } from '../../../src/presentation/editor/shell/formatLength';
import { formatWallExtent } from '../../../src/presentation/editor/structure/wallExtentInput';
import { wallSideControlLayout } from '../../../src/presentation/editor/structure/wallSideControlLayout';
import { wallFaceCue } from '../../../src/presentation/editor/structure/wallFaceCue';
import { structureCandidates } from '../../../src/presentation/editor/structure/structureCandidates';
import { structureRecords } from '../../../src/presentation/editor/structure/structureRecords';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { boundsOfZones } from '../../../src/presentation/editor/viewport/zoneExtent';
import { MarqueeSelection } from '../../../src/presentation/editor/selection/MarqueeSelection';
import { pointerAt, toolContext } from '../../helpers/tool-context';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200, sideExtents: { a: 150, b: 50 } };
const structure: Structure = { walls: [wall], openings: [{ id: 'opening-a', kind: 'window', hostId: wall.id, offset: 1000, width: 1000, height: 1200, sill: 800 }], boundaries: [] };

it('retains exact decimal values and steps just the chosen face, including zero and both total bounds', () => {
	const original = shallowRef<Wall | undefined>(), draft = createWallSideDraft(original);
	expect(draft.values.value).toBeNull(); expect(draft.canStep('b', 1)).toBe(false); expect(draft.step('a', 1)).toBe(false);
	original.value = { ...wall, thickness: 150.25, sideExtents: { a: 75.125, b: 75.125 } }; draft.reset(original.value);
	expect(draft.text.value).toEqual({ a: '0.075125', b: '0.075125' }); expect(draft.values.value).toEqual({ a: 75.125, b: 75.125 });
	draft.step('b', 1); expect(draft.values.value).toEqual({ a: 75.125, b: 85.125 }); draft.step('b', -1);
	draft.edit('a', '0,123456'); expect(draft.values.value?.a).toBe(123.456); draft.step('a', 1); expect(draft.values.value?.a).toBe(133.456);
	draft.edit('b', '0'); draft.edit('a', '0.001'); expect(draft.total.value).toBe(1); expect(draft.canStep('a', -1)).toBe(false); expect(draft.step('a', -1)).toBe(false);
	draft.edit('b', '0.001'); draft.edit('a', '0'); expect(draft.canStep('a', -1)).toBe(false); expect(draft.canStep('b', -1)).toBe(false);
	draft.edit('b', '999.999'); draft.step('a', 1); expect(draft.values.value).toEqual({ a: 1, b: 999999 }); expect(draft.canStep('a', 1)).toBe(false);
	draft.edit('a', 'bad'); expect(draft.total.value).toBeNull(); expect(draft.step('b', 1)).toBe(false);
	draft.reset(); expect(draft.values.value).toBeNull();
	for (const input of ['', 'NaN', '1e3', '1.2.3']) expect(parseExtentMetres(input)).toMatchObject({ ok: false, reason: 'not-a-number' });
	expect(parseExtentMetres('-0.1')).toMatchObject({ reason: 'not-positive' }); expect(parseExtentMetres('Infinity')).toMatchObject({ reason: 'too-large' }); expect(parseExtentMetres('1000.001')).toMatchObject({ reason: 'too-large' });
	expect(parseExtentMetres('-0')).toEqual({ ok: true, mm: 0 }); expect(formatWallExtent(0.000001)).toBe('0.000000001');
});

it('keeps the depth difference for total edits and refuses a negative resulting face', () => {
	expect(resizeWallTotal(wall, 240)).toEqual({ ...wall, thickness: 240, sideExtents: { a: 170, b: 70 } });
	expect(resizeWallTotal(wall, 200)).toBe(wall); expect(resizeWallTotal(wall, 100)?.sideExtents).toEqual({ a: 100, b: 0 });
	for (const total of [99, 0, Infinity, NaN, 1000001]) expect(resizeWallTotal(wall, total)).toBeNull();
	expect(wallSideAt(wall, { x: 2000, y: -125 })).toBe('a'); expect(wallSideAt(wall, { x: 2000, y: 25 })).toBe('b');
	expect(wallSnapReach(wall, { x: 2000, y: -125 }, 10)).toBe(150); expect(wallSnapReach(wall, { x: 2000, y: 25 }, 10)).toBe(50);
	expect(wallSnapReach({ ...wall, sideExtents: undefined }, { x: 2000, y: -125 }, 10)).toBe(10);
});

it('frames and selects the actual body and opening instead of a recentered total-width stroke', () => {
	const candidates = structureCandidates(structure), hit = (x: number, y: number) => resolveSelectionTarget({ candidates, selectedIds: [], worldPoint: { x, y }, handleToleranceWorld: 1 });
	expect(hit(500, -140)).toEqual({ kind: 'body', id: wall.id }); expect(hit(500, 90)).toBeNull();
	expect(hit(1500, -140)).toEqual({ kind: 'body', id: 'opening-a' }); expect(hit(500, -150.5)?.id).toBe(wall.id);
	expect(boundsOfZones(candidates)).toEqual({ min: { x: 0, y: -150 }, max: { x: 4000, y: 50 } });
	expect(boundsOfZones(structureRecords(structure, 'plan-a'))).toEqual(boundsOfZones(candidates));
	expect(candidates[0].points).toEqual([wall.start, wall.end]);
	const polygon = openingCutPolygon(structure.openings[0], wall); expect(polygon.map(point => point.y).toSorted((a, b) => a - b)).toEqual([-150, -150, 50, 50]);
	expect(openingSymbol(structure.openings[0], wall)).toBeTruthy();
	expect(structureCandidates({ ...structure, walls: [] })[0].hitRegions).toBeUndefined();
	const { context } = toolContext(), marquee = new MarqueeSelection();
	marquee.start(context, pointerAt(100, -180)); marquee.finish(context, pointerAt(700, -120), candidates);
	expect(context.selection.selectedIds).toEqual([wall.id]);
});

it('draws face cues only along solid spans and shows a direction arrow on the fixed datum', () => {
	const cue = expectDefined(wallFaceCue(structure, wall.id, 'a', 1), 'cue');
	expect(cue.faces).toEqual([[{ x: 0, y: -150 }, { x: 1000, y: -150 }], [{ x: 2000, y: -150 }, { x: 4000, y: -150 }]]);
	expect(cue.arrow[1]).toEqual({ x: 2000, y: 0 });
	expect(wallFaceCue(structure, 'missing', 'a', 1)).toBeNull();
	expect(wallFaceCue({ ...structure, walls: [{ ...wall, bulge: 1, sideExtents: { a: 150, b: 2000 } }] }, wall.id, 'a', 1)).toBeNull();
	const entire = { ...structure, openings: [{ ...structure.openings[0], offset: 0, width: 4000 }] };
	expect(wallFaceCue(entire, wall.id, 'b', 1)?.faces).toEqual([]);
});

it('keeps both 44px control groups separated and inside the usable canvas at every wall direction and edge', () => {
	for (const end of [{ x: 4000, y: 0 }, { x: 0, y: 4000 }, { x: -4000, y: 0 }, { x: 0, y: -4000 }, { x: 3000, y: 3000 }]) for (const pan of [{ x: -1500, y: -2000 }, { x: 0, y: 0 }, { x: 10000, y: 10000 }]) {
		const layout = expectDefined(wallSideControlLayout({ ...wall, end }, { zoom: 0.1, pan }, { width: 320, bottom: 500, cardHeight: 144 }), 'layout');
		const [a, b] = layout; expect(layout.map(item => item.side)).toEqual(['a', 'b']);
		for (const item of layout) { expect(item.x).toBeGreaterThanOrEqual(8); expect(item.x + item.width).toBeLessThanOrEqual(312); expect(item.y).toBeGreaterThanOrEqual(16); expect(item.y + 144).toBeLessThanOrEqual(500); }
		expect(Math.abs(a.x - b.x) >= 152 || Math.abs(a.y - b.y) >= 152).toBe(true);
	}
	expect(wallSideControlLayout(wall, { zoom: 1, pan: { x: 0, y: 0 } }, { width: 200, bottom: 500, cardHeight: 144 })).toBeNull();
	expect(wallSideControlLayout(wall, { zoom: 1, pan: { x: 0, y: 0 } }, { width: 320, bottom: 100, cardHeight: 144 })).toBeNull();
	expect(wallSideControlLayout(wall, { zoom: 1, pan: { x: 0, y: 0 } }, { width: 320, bottom: 220, cardHeight: 144 })).not.toBeNull();
	const masked = wallSideControlLayout(wall, { zoom: 0.1, pan: { x: 0, y: 0 } }, { width: 320, bottom: 500, cardHeight: 144 }, structure.openings);
	expect(masked?.[0].face.x).toBe(300);
	expect(wallSideControlLayout(wall, { zoom: 1, pan: { x: 0, y: 0 } }, { width: 320, bottom: 500, cardHeight: 144 }, [{ ...structure.openings[0], offset: 0, width: 4000 }])).toBeNull();
});

it('clips cues at either end of a T stem and never highlights a fully clipped segment', () => {
	const west = { ...wall, id: 'wall-west', start: { x: -4000, y: 0 }, end: { x: 0, y: 0 } }, east = wall;
	for (const reverse of [false, true]) {
		const start = { x: -3000, y: -3000 }, end = { x: 0, y: 0 }, stem = { ...wall, id: 'wall-stem', start: reverse ? end : start, end: reverse ? start : end, thickness: 700, sideExtents: { a: 300, b: 400 } };
		const floor = { walls: [west, east, stem], openings: [], boundaries: [] };
		for (const side of ['a', 'b'] as const) expect(wallFaceCue(floor, stem.id, side, 1)?.faces.flat().every(point => point.y <= 50 + 1e-8)).toBe(true);
		const endOpening = { ...structure.openings[0], hostId: stem.id, offset: reverse ? 80 : 0, width: Math.hypot(3000, 3000) - 80 };
		const cue = wallFaceCue({ ...floor, openings: [endOpening] }, stem.id, reverse ? 'a' : 'b', 1);
		expect(cue?.faces.flat().every(point => point.y <= 50 + 1e-8)).toBe(true);
	}
});
