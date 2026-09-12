import { describe, expect, it, vi } from 'vitest';
import { createStructureDraft, addWallPoint, draftStructure, mintStructure, numericWallPoint, openingFromDraft, snapWallPoint, wallsFromDraft, pickHost, validateDraftStructure, isStructureTool, startFromWall, wallStartRefused } from '../../../src/presentation/editor/structure/structureDraft';
import { StructureTool } from '../../../src/presentation/editor/structure/StructureTool';
import { expectDefined, expectErr, expectOk } from '../../helpers/domain';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { WALL_LOOP } from '../../helpers/structure';
import { toolContext, pointerAt } from '../../helpers/tool-context';

describe('wall task geometry and lifecycle', () => {
	it('keeps existing Room relationships and committed opening IDs while extending separate walls', () => {
		const draft = createStructureDraft(), opening = { id: 'opening-existing', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2000, sill: 0 };
		const existing = { ...WALL_LOOP, openings: [opening], boundaries: [{ roomId: 'room-existing', wallIds: WALL_LOOP.walls.map(wall => wall.id) }] };
		expect(addWallPoint(draft, { x: 10000, y: 0 }, existing)).toBe(true); expect(addWallPoint(draft, { x: 11000, y: 0 }, existing)).toBe(true);
		expect(mintStructure(expectDefined(draftStructure(draft, existing), 'extended structure')).openings).toEqual([opening]);
		pickHost(draft, { x: 3998, y: 1 }, WALL_LOOP.walls, 8); expect(draft.text.hostId).toBe('wall-a');
		pickHost(draft, { x: 3999, y: 2 }, WALL_LOOP.walls, 8); expect(draft.text.hostId).toBe('wall-b');
	});
	it('uses the same exact points for numeric and pointer segments', () => {
		const draft = createStructureDraft();
		expect(numericWallPoint(draft)).toEqual({ x: 0, y: 0 });
		expect(addWallPoint(draft, { x: 0, y: 0 }, EMPTY_STRUCTURE)).toBe(true);
		draft.text.length = '4,1234';
		expect(numericWallPoint(draft)).toEqual({ x: 4123, y: 0 });
		expect(addWallPoint(draft, { x: 4123, y: 0 }, EMPTY_STRUCTURE)).toBe(true);
		draft.text.length = '3'; draft.text.angle = '90';
		expect(numericWallPoint(draft)).toEqual({ x: 4123, y: 3000 });
		expect(addWallPoint(draft, { x: 4123, y: 3000 }, EMPTY_STRUCTURE)).toBe(true);
		expect(wallsFromDraft(draft)?.map(wall => wall.end)).toEqual([{ x: 4123, y: 0 }, { x: 4123, y: 3000 }]);
		expect(validateDraftStructure(draft, EMPTY_STRUCTURE, [])).toMatchObject({ error: { code: 'spatial.pending' } });
		draft.text.length = '';
		expect(validateDraftStructure(draft, EMPTY_STRUCTURE, []).ok).toBe(true);
		const proposed = expectDefined(draftStructure(draft), 'draft');
		expect(proposed).not.toBeNull();
		expect(mintStructure(proposed).walls[0].id).toMatch(/^wall-[0-9A-Z]{26}$/);
	});
	it.each(['', '1e3', 'Infinity', '0', '-2'])('refuses invalid length %s', length => {
		const draft = createStructureDraft(); draft.points = [{ x: 0, y: 0 }]; draft.text.length = length;
		expect(numericWallPoint(draft)).toBeNull();
	});
	it.each(['', 'abc', '361', '-361', '1e2'])('refuses invalid angle %s', angle => {
		const draft = createStructureDraft(); draft.points = [{ x: 0, y: 0 }]; draft.text.length = '1'; draft.text.angle = angle;
		expect(numericWallPoint(draft)).toBeNull();
	});
	it('refuses bad coordinates, dimensions, duplicate points, intersections and changes after closure', () => {
		const draft = createStructureDraft(); draft.text.x = 'invalid';
		expect(numericWallPoint(draft)).toBeNull();
		expect(draftStructure(draft)).toBeNull();
		draft.text.height = '';
		expect(addWallPoint(draft, { x: 0, y: 0 }, EMPTY_STRUCTURE)).toBe(false);
		expect(wallsFromDraft(draft)).toBeNull(); draft.text.height = '2.4';
		for (const point of WALL_LOOP.walls.map(wall => wall.start)) expect(addWallPoint(draft, point, EMPTY_STRUCTURE)).toBe(true);
		expect(addWallPoint(draft, draft.points[3], EMPTY_STRUCTURE)).toBe(false);
		expect(addWallPoint(draft, { x: 2000, y: -1000 }, EMPTY_STRUCTURE)).toBe(false);
		expect(addWallPoint(draft, draft.points[0], EMPTY_STRUCTURE)).toBe(true);
		expect(addWallPoint(draft, { x: 9000, y: 0 }, EMPTY_STRUCTURE)).toBe(false);
		draft.room = true;
		expect(validateDraftStructure(draft, EMPTY_STRUCTURE, []).ok).toBe(false);
		draft.roomName = 'Kitchen'; expect(validateDraftStructure(draft, EMPTY_STRUCTURE, []).ok).toBe(true);
		draft.points.pop(); expect(validateDraftStructure(draft, EMPTY_STRUCTURE, []).ok).toBe(false);
		draft.busy = true; expect(addWallPoint(draft, { x: 0, y: 0 }, EMPTY_STRUCTURE)).toBe(false);
	});
	it('snaps to the closest endpoint first, then axes, with exact numeric input unaffected', () => {
		expect(snapWallPoint({ x: 4001, y: 1 }, [], WALL_LOOP.walls, 8)).toEqual({ point: { x: 4000, y: 0 }, snapped: true });
		expect(snapWallPoint({ x: 5, y: 500 }, [{ x: 0, y: 0 }], [], 8)).toEqual({ point: { x: 0, y: 500 }, snapped: true });
		expect(snapWallPoint({ x: 500, y: 5 }, [{ x: 0, y: 0 }], [], 8)).toEqual({ point: { x: 500, y: 0 }, snapped: true });
		expect(snapWallPoint({ x: 500, y: 500 }, [{ x: 0, y: 0 }], [], 8).snapped).toBe(false);
		expect(snapWallPoint({ x: 500, y: 500 }, [], [], 8).snapped).toBe(false);
	});
	it('picks a host within tolerance, refuses an absent host and normalizes placement fields', () => {
		const draft = createStructureDraft(); draft.kind = 'place-window';
		pickHost(draft, { x: 500, y: 2 }, WALL_LOOP.walls, 8);
		expect(draft.text).toMatchObject({ hostId: 'wall-a', offset: '0.05' });
		expect(openingFromDraft(draft)).toMatchObject({ kind: 'window', offset: 50 });
		pickHost(draft, { x: -500, y: 500 }, WALL_LOOP.walls, 8); expect(draft.snapped).toBe(false);
		draft.kind = 'place-door'; expect(openingFromDraft(draft)?.kind).toBe('door');
		draft.kind = 'place-opening'; expect(openingFromDraft(draft)?.kind).toBe('opening');
		const proposed = expectDefined(draftStructure(draft, WALL_LOOP), 'opening draft');
		expect(mintStructure(proposed).walls).toEqual(WALL_LOOP.walls); expect(mintStructure(proposed).openings[0].id).toMatch(/^opening-/);
		draft.text.width = ''; expect(openingFromDraft(draft)).toBeNull(); expect(draftStructure(draft)).toBeNull();
	});
	it('owns only temporary pointer work and cancels/finishes through the shared actions', () => {
		const draft = createStructureDraft(), start = vi.fn<() => void>(), stop = vi.fn<() => void>(), finish = vi.fn<() => void>();
		let blocked = false;
		const tool = new StructureTool('draw-wall', { draft, structure: () => EMPTY_STRUCTURE, start, stop, finish, blocked: () => blocked });
		tool.pointerDown(pointerAt(0, 0)); tool.pointerMove(pointerAt(0, 0));
		const { context } = toolContext(); tool.activate(context); expect(start).toHaveBeenCalledWith('draw-wall');
		tool.pointerDown({ ...pointerAt(0, 0), button: 'secondary' }); expect(tool.hasDraft()).toBe(false);
		tool.pointerDown(pointerAt(0, 0)); tool.pointerDown(pointerAt(4000, 0)); tool.pointerUp();
		tool.abandonGesture(); expect(draft.points).toHaveLength(2); expect(tool.hasDraft()).toBe(true);
		expect(tool.editCorner(9, null)).toBe(false); expect(tool.editCorner(1, null)).toBe(true);
		blocked = true; tool.pointerDown(pointerAt(1000, 0)); tool.pointerMove(pointerAt(1000, 0)); expect(tool.editCorner(-1, null)).toBe(false);
		draft.busy = true; tool.cancel(); expect(draft.points).toHaveLength(1);
		blocked = false; draft.busy = false; tool.cancel(); expect(tool.hasDraft()).toBe(false);
		draft.text.length = '2'; expect(tool.hasDraft()).toBe(true);
		tool.finish(); expect(finish).toHaveBeenCalledOnce(); tool.deactivate(); expect(stop).toHaveBeenCalledOnce();
	});
	it('routes all opening tools through the host picker and identifies only its own tool IDs', () => {
		const draft = createStructureDraft();
		const tool = new StructureTool('place-door', { draft, structure: () => WALL_LOOP, start: vi.fn<() => void>(), stop: vi.fn<() => void>(), finish: vi.fn<() => void>(), blocked: () => false });
		tool.activate(toolContext().context); tool.pointerDown(pointerAt(1000, 0)); expect(draft.text.hostId).toBe('wall-a');
		for (const id of ['draw-wall', 'place-door', 'place-window', 'place-opening']) expect(isStructureTool(id)).toBe(true);
		for (const id of [null, 'select', 'draw-room']) expect(isStructureTool(id)).toBe(false);
	});

	it('starts a wall in the middle of a wall by cutting it, and only while the draft still starts at the cut', () => {
		const door = { id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 };
		const existing = { ...WALL_LOOP, openings: [door] }, draft = createStructureDraft();
		expect(startFromWall(draft, existing, 'wall-a', { x: 2000.4, y: 40 }, 8)).toBe(true);
		expect(draft.points).toEqual([{ x: 2000, y: 0 }]);
		expect(addWallPoint(draft, { x: 2000, y: 1500 }, existing)).toBe(true);
		const walls = expectOk(validateDraftStructure(draft, existing, [])).walls;
		expect(walls.map(wall => wall.id)).toEqual(['wall-a', expect.stringMatching(/^wall-[0-9A-Z]{26}$/), 'wall-b', 'wall-c', 'wall-d', 'wall-draft-0']);
		expect(walls[0].end).toEqual({ x: 2000, y: 0 }); expect(existing.walls[0].end).toEqual({ x: 4000, y: 0 });
		draft.points = []; expect(addWallPoint(draft, { x: 1000, y: 500 }, existing)).toBe(true); expect(addWallPoint(draft, { x: 1000, y: 2000 }, existing)).toBe(true);
		expect(expectOk(validateDraftStructure(draft, existing, [])).walls).toHaveLength(5);
	});
	it('starts at a wall end within tolerance and refuses a start inside an opening or on a missing wall', () => {
		const existing = { ...WALL_LOOP, openings: [{ id: 'opening-door', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2100, sill: 0 }] };
		const atEnd = createStructureDraft();
		expect(startFromWall(atEnd, existing, 'wall-a', { x: 3995, y: 0 }, 8)).toBe(true);
		expect(atEnd.points).toEqual([{ x: 4000, y: 0 }]); expect(atEnd.split).toBeNull();
		const inside = createStructureDraft();
		expect(startFromWall(inside, existing, 'wall-a', { x: 900, y: 0 }, 8)).toBe(false);
		expect(inside.error?.code).toBe('spatial.opening-split'); expect(inside.points).toEqual([]);
		expect(wallStartRefused(existing, 'wall-a', { x: 900, y: 0 }, 8)).toBe(true); expect(wallStartRefused(existing, 'wall-a', { x: 2000, y: 0 }, 8)).toBe(false);
		const missing = createStructureDraft();
		expect(startFromWall(missing, existing, 'wall-gone', { x: 0, y: 0 }, 8)).toBe(false); expect(missing.error?.code).toBe('spatial.host-missing');
	});

	it('refuses a placement draft whose swing cannot be parsed before it builds any structure', () => {
		const draft = createStructureDraft();
		draft.kind = 'place-door'; draft.swing.angle = 'a quarter turn';
		expect(expectErr(validateDraftStructure(draft, EMPTY_STRUCTURE, [])).code).toBe('spatial.opening-swing');
		// A plain opening carries no swing to parse, so the same draft reaches the host check instead.
		draft.kind = 'place-opening';
		expect(expectErr(validateDraftStructure(draft, EMPTY_STRUCTURE, [])).code).not.toBe('spatial.opening-swing');
	});
});
