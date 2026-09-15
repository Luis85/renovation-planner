import { Decimal } from 'decimal.js';
import type { Point } from '../../core/geometry/Point';
import { projectOntoWall, wallTangent, type Structure, type Wall, type WallSide, type WallSideExtents } from './Structure';

export const MIN_WALL_TOTAL = 1;
export const MAX_WALL_TOTAL = 1_000_000;

/** A legacy centre-line wall has two equal extents; resolving them never mutates it. */
export function wallSideExtents(wall: Pick<Wall, 'thickness' | 'sideExtents'>): WallSideExtents {
	return wall.sideExtents ?? { a: wall.thickness / 2, b: wall.thickness / 2 };
}
export const wallSideNormal = (tangent: Point, side: WallSide): Point => side === 'a' ? { x: tangent.y, y: -tangent.x } : { x: -tangent.y, y: tangent.x };
/** Decimal addition avoids an independently stored total differing from the entered decimal distances. */
export const wallTotal = (sides: WallSideExtents): number => new Decimal(sides.a).plus(sides.b).toNumber();
export function validWallSides(wall: Pick<Wall, 'thickness' | 'sideExtents'>): boolean {
	const sides = wallSideExtents(wall);
	return wall.sideExtents !== null && [sides.a, sides.b].every(value => Number.isFinite(value) && value >= 0 && value <= MAX_WALL_TOTAL)
		&& wall.thickness >= MIN_WALL_TOTAL && wall.thickness <= MAX_WALL_TOTAL && wallTotal(sides) === wall.thickness;
}
export function asymmetricWall(wall: Pick<Wall, 'thickness' | 'sideExtents'>): boolean { const sides = wallSideExtents(wall); return sides.a !== sides.b; }

export function wallSideAt(wall: Wall, point: Point, projection = projectOntoWall(wall, point)): WallSide {
	const normal = wallSideNormal(wallTangent(wall, projection.offset), 'a');
	return (point.x - projection.point.x) * normal.x + (point.y - projection.point.y) * normal.y >= 0 ? 'a' : 'b';
}
/** Preserve legacy snap reach; an independently offset face can be reached anywhere inside its body. */
export function wallSnapReach(wall: Wall, point: Point, tolerance: number, projection = projectOntoWall(wall, point)): number {
	return asymmetricWall(wall) ? Math.max(tolerance, wallSideExtents(wall)[wallSideAt(wall, point, projection)]) : tolerance;
}

/** Legacy total edits move both faces equally; they never translate or silently recenter the wall. */
export function resizeWallTotal(wall: Wall, thickness: number): Wall | null {
	if (!Number.isFinite(thickness) || thickness < MIN_WALL_TOTAL || thickness > MAX_WALL_TOTAL) return null;
	if (thickness === wall.thickness) return wall;
	const previous = wallSideExtents(wall), delta = new Decimal(thickness).minus(wall.thickness).div(2);
	const sideExtents = { a: new Decimal(previous.a).plus(delta).toNumber(), b: new Decimal(previous.b).plus(delta).toNumber() };
	if (sideExtents.a < 0 || sideExtents.b < 0) return null;
	return { ...wall, sideExtents, thickness: wallTotal(sideExtents) };
}
export function withWallSideExtents(structure: Structure, id: string, sides: WallSideExtents): Structure | null {
	if (![sides.a, sides.b].every(value => Number.isFinite(value) && value >= 0 && value <= MAX_WALL_TOTAL)) return null;
	const thickness = wallTotal(sides);
	if (thickness < MIN_WALL_TOTAL || thickness > MAX_WALL_TOTAL || !structure.walls.some(wall => wall.id === id)) return null;
	return { ...structure, walls: structure.walls.map(wall => wall.id === id ? { ...wall, thickness, sideExtents: { ...sides } } : wall) };
}

export function scaleWallSides(wall: Wall, factor: number): Pick<Wall, 'thickness' | 'sideExtents'> {
	if (!wall.sideExtents) return { thickness: wall.thickness * factor };
	const sideExtents = { a: wall.sideExtents.a * factor, b: wall.sideExtents.b * factor };
	return { sideExtents, thickness: wallTotal(sideExtents) };
}
