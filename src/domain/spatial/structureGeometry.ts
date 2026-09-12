import type { Point } from '../../core/geometry/Point';
import type { ValidationError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';
import { samePoint, wallLength, type Opening, type Structure, type Wall } from './Structure';
import { validSpatialElement } from './SpatialElement';
import { validOpeningSwing } from './openingSwing';
import { arcExtrema, arcRadius } from '../../core/geometry/circularArc';
import { circularEdgeIntersections, curveTolerance } from '../../core/geometry/circularIntersections';

export function spatialError(detail: string): ValidationError {
	return { category: 'Validation', code: `spatial.${detail}`, message: `Invalid spatial structure: ${detail}.` };
}
const cross = (a: Point, b: Point, c: Point): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const on = (a: Point, b: Point, p: Point): boolean => cross(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);

/** End-to-end junctions only. Crossings, T junctions and collinear overlap require splitting. */
export function wallsConflict(a: Pick<Wall, 'start' | 'end' | 'bulge'>, b: Pick<Wall, 'start' | 'end' | 'bulge'>): boolean {
	const shared = [a.start, a.end].filter(p => samePoint(p, b.start) || samePoint(p, b.end));
	if (a.bulge || b.bulge) {
		const result = circularEdgeIntersections({ ...a, bulge: a.bulge ?? 0 }, { ...b, bulge: b.bulge ?? 0 }), epsilon = curveTolerance([a.start, a.end, b.start, b.end]);
		return result.overlap || result.points.some(point => !shared.some(junction => Math.hypot(point.x - junction.x, point.y - junction.y) <= epsilon));
	}
	if (shared.length === 2) return true;
	if (shared.length === 1) {
		const otherA = samePoint(a.start, shared[0]) ? a.end : a.start;
		const otherB = samePoint(b.start, shared[0]) ? b.end : b.start;
		return on(a.start, a.end, otherB) || on(b.start, b.end, otherA);
	}
	const c1 = cross(a.start, a.end, b.start), c2 = cross(a.start, a.end, b.end);
	const c3 = cross(b.start, b.end, a.start), c4 = cross(b.start, b.end, a.end);
	return (c1 * c2 < 0 && c3 * c4 < 0) || on(a.start, a.end, b.start) || on(a.start, a.end, b.end) || on(b.start, b.end, a.start) || on(b.start, b.end, a.end);
}

/** Limit coordinates to ±1000 km to keep millimetre geometry numerically representable. */
export const validSpatialPoint = (point: Point): boolean => [point.x, point.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1e9);
const dimension = (n: number): boolean => Number.isFinite(n) && n >= 1 && n <= 1e6;

export function openingValidationError(opening: Opening, structure: Structure): ValidationError | null {
	if (!validOpeningSwing(opening)) return spatialError('opening-swing');
	const host = structure.walls.find(wall => wall.id === opening.hostId);
	if (!host) return spatialError('host-missing');
	const numbers = [opening.width, opening.height, opening.offset, opening.sill];
	const dimensionsValid = dimension(opening.width) && dimension(opening.height) && numbers.every(n => Number.isFinite(n));
	const contained = opening.offset >= 0 && opening.sill >= 0 && opening.offset + opening.width <= wallLength(host) && opening.sill + opening.height <= host.height;
	if (!opening.id.startsWith('opening-') || !['door', 'window', 'opening'].includes(opening.kind) || !dimensionsValid || !contained) return spatialError('opening-containment');
	return structure.openings.some(other => other !== opening && other.hostId === opening.hostId && opening.offset < other.offset + other.width && other.offset < opening.offset + opening.width) ? spatialError('opening-overlap') : null;
}

function validWallCurve(wall: Wall): boolean {
	const bulge = wall.bulge ?? 0;
	if (!Number.isFinite(bulge) || Math.abs(bulge) > 1) return false;
	if (bulge === 0) return true;
	const edge = { start: wall.start, end: wall.end, bulge }, radius = arcRadius(edge);
	return radius !== null && Number.isFinite(radius) && radius > 0 && arcExtrema(edge).every(point => validSpatialPoint(point));
}
function validWall(wall: Wall): boolean {
	return wall.id.startsWith('wall-') && validSpatialPoint(wall.start) && validSpatialPoint(wall.end) && validWallCurve(wall) && [wallLength(wall), wall.height, wall.thickness].every(n => dimension(n));
}

export function validateStructure(structure: Structure, roomIds: readonly string[]): Result<Structure, ValidationError> {
	const ids = [...structure.walls, ...structure.openings, ...structure.elements ?? []].map(item => item.id);
	if (new Set(ids).size !== ids.length || ids.some(id => !id || roomIds.includes(id))) return err(spatialError('duplicate-id'));
	if (!structure.elements?.every(validSpatialElement) && structure.elements !== undefined) return err(spatialError('element-invalid'));
	if (!structure.walls.every(validWall)) return err(spatialError('wall-dimensions'));
	for (let i = 0; i < structure.walls.length; i++) {
		if (structure.walls.slice(i + 1).some(other => wallsConflict(structure.walls[i], other))) return err(spatialError('intersection'));
	}
	for (const opening of structure.openings) {
		const failure = openingValidationError(opening, structure);
		if (failure) return err(failure);
	}
	const wallIds = new Set(structure.walls.map(wall => wall.id));
	if (new Set(structure.boundaries.map(boundary => boundary.roomId)).size !== structure.boundaries.length || structure.boundaries.some(boundary => !roomIds.includes(boundary.roomId) || boundary.wallIds.length < 3 || new Set(boundary.wallIds).size !== boundary.wallIds.length || boundary.wallIds.some(id => !wallIds.has(id)))) return err(spatialError('room-missing'));
	return ok(structure);
}

export function closedChain(points: readonly Point[]): boolean {
	return points.length >= 4 && samePoint(points[0], points[points.length - 1]);
}

/** The start is anchored. Every endpoint at the old end follows the same junction. */
export function editWall(structure: Structure, edited: Wall): Structure {
	const old = structure.walls.find(wall => wall.id === edited.id);
	if (!old) return structure;
	return { ...structure, walls: structure.walls.map(wall => wall.id === edited.id ? edited : ({ ...wall,
		start: samePoint(wall.start, old.end) ? edited.end : wall.start,
		end: samePoint(wall.end, old.end) ? edited.end : wall.end,
	})) };
}

export function scaleStructure(structure: Structure, factor: number): Structure {
	const point = (p: Point): Point => ({ x: p.x * factor, y: p.y * factor });
	return { ...structure,
		...(structure.elements ? { elements: structure.elements.map(element => ({ ...element, points: element.points.map(point), ...(element.stair ? { stair: { ...element.stair, width: element.stair.width * factor } } : {}), ...(element.labelOffset ? { labelOffset: { dx: element.labelOffset.dx * factor, dy: element.labelOffset.dy * factor } } : {}) })) } : {}),
		walls: structure.walls.map(wall => ({ ...wall, start: point(wall.start), end: point(wall.end), height: wall.height * factor, thickness: wall.thickness * factor })),
		openings: structure.openings.map(opening => ({ ...opening, offset: opening.offset * factor, width: opening.width * factor, height: opening.height * factor, sill: opening.sill * factor })),
	};
}
