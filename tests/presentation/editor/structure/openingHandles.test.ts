import { expect, it } from 'vitest';
import { openingHandles, selectedOpeningHandles } from '../../../../src/presentation/editor/structure/openingHandles';
import { openingSymbol } from '../../../../src/domain/spatial/openingGeometry';
import { alongWall, type Opening, type Structure, type Wall } from '../../../../src/domain/spatial/Structure';
import { OPENING_CHEVRON_GAP_PX } from '../../../../src/presentation/editor/handleMetrics';
import { expectDefined } from '../../../helpers/domain';
import type { EntityId } from '../../../../src/core/identity/EntityId';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 1200, height: 2100, sill: 0 };
const grips = (handles: readonly { grip: string }[]) => handles.map(handle => handle.grip);

it('places the centre-line marks at quarters of the opening, along the host', () => {
	const handles = openingHandles(door, wall, 1);
	expect(grips(handles)).toEqual(['width-start', 'step-back', 'move', 'step-forward', 'width-end', 'side-left', 'side-right']);
	expect(handles[0].point).toEqual(alongWall(wall, 800));
	expect(handles[2].point).toEqual(alongWall(wall, 1400));
	expect(handles[4].point).toEqual(alongWall(wall, 2000));
});

it('follows a curved host rather than a straight chord', () => {
	const host = { ...wall, bulge: 0.5 };
	const handles = openingHandles(door, host, 1);
	expect(handles[2].point).toEqual(alongWall(host, 1400));
	expect(handles[2].point.y).not.toBe(0);
});

it('puts each chevron on the wall face its swing value means', () => {
	// `openingSymbol` draws a left-swinging leaf on one side; the left chevron must be on that side.
	const leaf = openingSymbol({ ...door, swing: { hinge: 'start', side: 'left', angle: 90 } }, wall);
	const left = expectDefined(openingHandles(door, wall, 1).find(handle => handle.grip === 'side-left'), 'left chevron');
	const right = expectDefined(openingHandles(door, wall, 1).find(handle => handle.grip === 'side-right'), 'right chevron');
	expect(Math.sign(left.point.y)).toBe(Math.sign(leaf.leaf[1].y - leaf.leaf[0].y));
	expect(Math.sign(right.point.y)).toBe(-Math.sign(left.point.y));
	// Off the centre-line by the face's own extent plus the gap; this wall's faces are 100 mm each.
	expect(Math.abs(left.point.y)).toBeCloseTo(100 + OPENING_CHEVRON_GAP_PX);
});

it('measures the chevron off an asymmetric wall face rather than half its thickness', () => {
	const host = { ...wall, sideExtents: { a: 50, b: 150 } };
	const handles = openingHandles(door, host, 1);
	const left = expectDefined(handles.find(handle => handle.grip === 'side-left'), 'left chevron');
	const right = expectDefined(handles.find(handle => handle.grip === 'side-right'), 'right chevron');
	expect(Math.abs(left.point.y)).toBeCloseTo(50 + OPENING_CHEVRON_GAP_PX);
	expect(Math.abs(right.point.y)).toBeCloseTo(150 + OPENING_CHEVRON_GAP_PX);
});

it('drops the step arrows, then everything but the move grip, as the marks crowd together', () => {
	// Separation between adjacent centre-line marks is width / 4; the floor is 16 screen pixels.
	expect(grips(openingHandles(door, wall, 1200 / 4 / 16))).toContain('step-back');
	expect(grips(openingHandles(door, wall, 1200 / 4 / 16 + 0.001))).not.toContain('step-back');
	expect(grips(openingHandles(door, wall, 1200 / 4 / 16 + 0.001))).toEqual(['width-start', 'move', 'width-end', 'side-left', 'side-right']);
	expect(grips(openingHandles(door, wall, 1200 / 16 + 0.001))).toEqual(['move', 'side-left', 'side-right']);
});

it('draws no chevron for an opening with no leaf', () => {
	expect(grips(openingHandles({ ...door, kind: 'opening' }, wall, 1))).toEqual(['width-start', 'step-back', 'move', 'step-forward', 'width-end']);
	expect(grips(openingHandles({ ...door, kind: 'window' }, wall, 1))).toContain('side-left');
});

/** Hosted by a wall that is not in the structure: the arm where an opening is found and its host is not. */
const orphan: Opening = { ...door, id: 'opening-orphan', hostId: 'wall-gone' };
const structure: Structure = { walls: [wall], openings: [door, orphan], boundaries: [] };
const ids = (values: readonly string[]) => values.map(value => value as EntityId<string>);

it('resolves the one selected opening and its host, the same answer openingHandles itself gives', () => {
	expect(selectedOpeningHandles(structure, ids([door.id]), 1)).toEqual({ id: door.id, handles: openingHandles(door, wall, 1) });
});

it('answers null for no selection, a multi-selection, a selected wall, or a hostless opening', () => {
	expect(selectedOpeningHandles(structure, ids([]), 1)).toBeNull();
	expect(selectedOpeningHandles(structure, ids([door.id, wall.id]), 1)).toBeNull();
	expect(selectedOpeningHandles(structure, ids([wall.id]), 1)).toBeNull();
	expect(selectedOpeningHandles(structure, ids([orphan.id]), 1)).toBeNull();
});
