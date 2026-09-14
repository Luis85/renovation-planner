import type { Structure } from './Structure';
import { resizeWallTotal, MAX_WALL_TOTAL, MIN_WALL_TOTAL } from './wallSides';

/** Existing spatial dimension bounds, in millimetres; no material-specific assumptions. */
export const MIN_WALL_THICKNESS = MIN_WALL_TOTAL;
export const MAX_WALL_THICKNESS = MAX_WALL_TOTAL;
export const WALL_THICKNESS_STEP = 10;

/** A whole-wall change preserves the centre line, joins, hosted openings and all metadata. */
export function withWallThickness(structure: Structure, id: string, thickness: number): Structure | null {
	if (!Number.isFinite(thickness) || thickness < MIN_WALL_THICKNESS || thickness > MAX_WALL_THICKNESS || !structure.walls.some(wall => wall.id === id)) return null;
	const target = structure.walls.find(wall => wall.id === id);
	const edited = target && resizeWallTotal(target, thickness);
	return edited ? { ...structure, walls: structure.walls.map(wall => wall.id === id ? edited : wall) } : null;
}
