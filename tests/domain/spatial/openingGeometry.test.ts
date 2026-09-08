import { expect, it } from 'vitest';
import { openingOffsetAt, openingSymbol } from '../../../src/domain/spatial/openingGeometry';
import { alongWall, endForWallLength, wallLength, wallTangent, type Opening, type Wall } from '../../../src/domain/spatial/Structure';
import { rotateWallStructure } from '../../../src/domain/spatial/rotateWall';
import { scaleStructure } from '../../../src/domain/spatial/structureGeometry';
import { expectOk } from '../../helpers/domain';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 150 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 900, height: 2100, sill: 0 };

it('places and renders openings along curved hosts with local jamb and hinge tangents', () => {
	const host = { ...wall, bulge: 0.5 }, middle = wallLength(host) / 2;
	expect(endForWallLength(host, wallLength(host))).toBe(host.end);
	const resized = { ...host, end: endForWallLength(host, wallLength(host) * 1.5) };
	expect(wallLength(resized)).toBeCloseTo(wallLength(host) * 1.5); expect(resized.end.y).toBe(host.end.y);
	const point = alongWall(host, middle);
	expect(openingOffsetAt(host, point, door.width)).toBeCloseTo(middle - door.width / 2);
	const opening = { ...door, offset: middle - door.width / 2 }, symbol = openingSymbol(opening, host);
	expect(symbol.cut.length).toBeGreaterThan(2);
	expect(symbol.cut[0]).toEqual(alongWall(host, opening.offset));
	expect(symbol.cut.at(-1)).toEqual(alongWall(host, opening.offset + opening.width));
	const tangent = wallTangent(host, opening.offset);
	expect(symbol.leaf[1].x - symbol.leaf[0].x).toBeCloseTo(door.width * tangent.y);
	expect(symbol.leaf[1].y - symbol.leaf[0].y).toBeCloseTo(-door.width * tangent.x);
	const closedWindow = openingSymbol({ ...opening, kind: 'window' }, host);
	expect(closedWindow.leaf).toEqual(closedWindow.cut);
	expect(closedWindow.frame[2]).toHaveLength(closedWindow.cut.length);
});

it('centres click placement on horizontal and reversed vertical hosts and clamps complete width', () => {
	expect(openingOffsetAt(wall, { x: 2000, y: 50 }, 900)).toBe(1550);
	expect(openingOffsetAt(wall, { x: 20, y: 0 }, 900)).toBe(0);
	expect(openingOffsetAt(wall, { x: 3990, y: 0 }, 900)).toBe(3100);
	expect(openingOffsetAt({ ...wall, start: { x: 100, y: 4000 }, end: { x: 100, y: 0 } }, { x: 110, y: 2000 }, 900)).toBe(1550);
	expect(openingOffsetAt(wall, { x: 0, y: 0 }, 4001)).toBeNull();
	expect(openingOffsetAt(wall, { x: NaN, y: 0 }, 900)).toBeNull();
});

it('draws doors with the persisted hinge, side and angle, including closed and 180-degree leaves', () => {
	const defaults = openingSymbol(door, wall);
	expect(defaults.cut).toEqual([{ x: 800, y: 0 }, { x: 1700, y: 0 }]);
	expect(defaults.leaf[0]).toEqual({ x: 800, y: 0 });
	expect(defaults.leaf[1].x).toBeCloseTo(800);
	expect(defaults.leaf[1].y).toBeCloseTo(-900);
	expect(defaults.arc[0]).toEqual({ x: 1700, y: 0 });
	const reversed = openingSymbol({ ...door, swing: { hinge: 'end', side: 'right', angle: 90 } }, wall);
	expect(reversed.leaf[0]).toEqual({ x: 1700, y: 0 });
	expect(reversed.leaf[1].y).toBeCloseTo(900);
	const flat = openingSymbol({ ...door, swing: { hinge: 'start', side: 'left', angle: 180 } }, wall);
	expect(flat.leaf[1].x).toBeCloseTo(-100);
	expect(flat.leaf[1].y).toBeCloseTo(0);
});

it('gives Windows their own closed frame and plain Openings only wall cuts and jambs', () => {
	const window = openingSymbol({ ...door, kind: 'window' }, wall);
	expect(window.frame).toHaveLength(4);
	expect(window.leaf).toEqual(window.cut);
	expect(window.arc).toEqual([]);
	const opening = openingSymbol({ ...door, kind: 'opening' }, wall);
	expect(opening.frame).toHaveLength(2);
	expect(opening.leaf).toEqual([]);
	expect(opening.arc).toEqual([]);
});

it('carries persisted swing through host rotation and calibration while deriving the new symbol position', () => {
	const opening = { ...door, swing: { hinge: 'start' as const, side: 'left' as const, angle: 90 } };
	const structure = { walls: [wall], openings: [opening], boundaries: [] };
	const turned = expectOk(rotateWallStructure(structure, wall.id, 90));
	expect(turned.openings).toEqual([opening]);
	const symbol = openingSymbol(turned.openings[0], turned.walls[0]);
	expect(symbol.leaf[1].x).toBeCloseTo(2900);
	expect(symbol.leaf[1].y).toBeCloseTo(-1200);
	const scaled = scaleStructure(turned, 2);
	expect(scaled.openings[0].swing).toEqual(opening.swing);
	expect(scaled.openings[0].width).toBe(1800);
});
