import type { Point } from '../../core/geometry/Point';
import type { SpatialElement } from './SpatialElement';
import { arcLength, arcPoint, arcProjection, arcTangent } from '../../core/geometry/circularArc';

/** Centre-line walls with optional circular curvature; all measurements are world millimetres. */
export interface Wall {
	readonly bulge?: number;
	readonly id: string;
	readonly start: Point;
	readonly end: Point;
	readonly thickness: number;
	readonly height: number;
}
export interface Opening {
	readonly id: string;
	readonly kind: 'door' | 'window' | 'opening';
	readonly hostId: string;
	readonly offset: number;
	readonly width: number;
	readonly height: number;
	readonly sill: number;
	readonly swing?: OpeningSwing;
}
/** Hinge follows the host's directed endpoints; side is viewed along start → end. */
export interface OpeningSwing {
	readonly hinge: 'start' | 'end';
	readonly side: 'left' | 'right';
	readonly angle: number;
}
export interface RoomBoundary {
	readonly roomId: string;
	readonly wallIds: readonly string[];
}
export interface Structure {
	readonly elements?: readonly SpatialElement[];
	readonly walls: readonly Wall[];
	readonly openings: readonly Opening[];
	readonly boundaries: readonly RoomBoundary[];
}
export const EMPTY_STRUCTURE: Structure = { walls: [], openings: [], boundaries: [] };
export const wallLength = (wall: Wall): number => arcLength({ start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 });

/** A length edit scales the chord with the same bend, preserving heading and start anchor. */
export function endForWallLength(wall: Wall, length: number): Point {
	const original = wallLength(wall);
	if (length === original) return wall.end;
	const factor = length / original;
	return { x: wall.start.x + (wall.end.x - wall.start.x) * factor, y: wall.start.y + (wall.end.y - wall.start.y) * factor };
}
export const samePoint = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
export function alongWall(wall: Wall, offset: number): Point {
	return arcPoint({ start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 }, offset / wallLength(wall));
}
export function wallTangent(wall: Wall, offset: number): Point { return arcTangent({ start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 }, offset / wallLength(wall)); }
export function projectOntoWall(wall: Wall, point: Point) {
	const projection = arcProjection({ start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 }, point);
	return { ...projection, offset: projection.fraction * wallLength(wall) };
}

/** Derived hit/render line; openings never persist independent world endpoints. */
export function openingPoints(opening: Opening, walls: readonly Wall[]): readonly Point[] {
	const host = walls.find(wall => wall.id === opening.hostId);
	return host ? [alongWall(host, opening.offset), alongWall(host, opening.offset + opening.width)] : [];
}
