import type { Point } from '../../../core/geometry/Point';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Structure } from '../../../domain/spatial/Structure';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { outlineKind } from '../../../domain/spatial/SpatialElement';
import { openingPoints } from '../../../domain/spatial/Structure';
import { extentOf } from '../../../core/geometry/operations';
import type { SnapCandidates } from './snap-service';

export interface SnapZone { readonly id: string; readonly points: readonly Point[]; readonly bulges?: readonly number[] }

interface Collected { readonly vertices: Point[]; readonly edges: (LineSegment & { readonly bulge?: number })[]; readonly alignments: Point[] }

function collectZone(zone: SnapZone, into: Collected): void {
	into.vertices.push(...zone.points); into.alignments.push(...zone.points);
	if (zone.points.length < 2) return;
	const { minX, maxX, minY, maxY } = extentOf(zone.points);
	into.alignments.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
	zone.points.forEach((point, index) => into.edges.push({ start: point, end: zone.points[(index + 1) % zone.points.length], ...(zone.bulges?.[index] ? { bulge: zone.bulges[index] } : {}) }));
}

function collectElement(element: SpatialElement, into: Collected): void {
	into.vertices.push(...element.points); into.alignments.push(...element.points);
	element.points.slice(1).forEach((point, index) => into.edges.push({ start: element.points[index], end: point }));
	if (outlineKind(element.kind) && element.points.length > 2) into.edges.push({ start: element.points[element.points.length - 1], end: element.points[0] });
}

/**
 * Existing zone boundaries, wall centre lines, opening endpoints and element geometry as snap
 * candidates; this projection never changes ownership. `alignments` is every vertex plus each
 * zone's box centre, for the axis stage. An entity whose id is in `exclude` contributes nothing,
 * so a dragged zone or element never snaps or aligns to itself.
 */
export function roomSnapCandidates(zones: Iterable<SnapZone>, structure: Structure, exclude: ReadonlySet<string> = new Set()): SnapCandidates {
	const into: Collected = { vertices: [], edges: [], alignments: [] };
	for (const zone of zones) if (!exclude.has(zone.id)) collectZone(zone, into);
	for (const wall of structure.walls) { into.vertices.push(wall.start, wall.end); into.alignments.push(wall.start, wall.end); into.edges.push({ start: wall.start, end: wall.end, ...(wall.bulge ? { bulge: wall.bulge } : {}) }); }
	for (const opening of structure.openings) into.vertices.push(...openingPoints(opening, structure.walls));
	for (const element of structure.elements ?? []) if (!exclude.has(element.id)) collectElement(element, into);
	return into;
}
