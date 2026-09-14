import type { Structure } from './Structure';

/** Existing spatial dimension bounds, in millimetres; no material-specific assumptions. */
export const MIN_WALL_THICKNESS = 1;
export const MAX_WALL_THICKNESS = 1_000_000;
export const WALL_THICKNESS_STEP = 10;

/** A whole-wall change preserves the centre line, joins, hosted openings and all metadata. */
export function withWallThickness(structure: Structure, id: string, thickness: number): Structure | null {
	if (!Number.isFinite(thickness) || thickness < MIN_WALL_THICKNESS || thickness > MAX_WALL_THICKNESS || !structure.walls.some(wall => wall.id === id)) return null;
	return { ...structure, walls: structure.walls.map(wall => wall.id === id ? { ...wall, thickness } : wall) };
}
