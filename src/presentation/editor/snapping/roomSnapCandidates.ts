import type { Point } from '../../../core/geometry/Point';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Structure } from '../../../domain/spatial/Structure';
import { openingPoints } from '../../../domain/spatial/Structure';
import { extentOf } from '../../../core/geometry/operations';
import type { SnapCandidates } from './snap-service';

interface SnapZone { readonly id: string; readonly points: readonly Point[]; readonly bulges?: readonly number[] }

/**
 * Existing zone boundaries, wall centre lines, opening endpoints and element geometry as snap
 * candidates; this projection never changes ownership. `alignments` is every vertex plus each
 * zone's box centre, for the axis stage. An entity whose id is in `exclude` contributes nothing,
 * so a dragged zone or element never snaps or aligns to itself.
 */
export function roomSnapCandidates(zones: Iterable<SnapZone>, structure: Structure, exclude: ReadonlySet<string> = new Set()): SnapCandidates {
 const vertices: Point[] = [], edges: (LineSegment & { readonly bulge?: number })[] = [], alignments: Point[] = [];
 for (const zone of zones) {
  if (exclude.has(zone.id)) continue;
  vertices.push(...zone.points); alignments.push(...zone.points);
  if (zone.points.length < 2) continue;
  const { minX, maxX, minY, maxY } = extentOf(zone.points);
  alignments.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
  zone.points.forEach((point, index) => edges.push({ start: point, end: zone.points[(index + 1) % zone.points.length], ...(zone.bulges?.[index] ? { bulge: zone.bulges[index] } : {}) }));
 }
 for (const wall of structure.walls) { vertices.push(wall.start, wall.end); alignments.push(wall.start, wall.end); edges.push({ start: wall.start, end: wall.end, ...(wall.bulge ? { bulge: wall.bulge } : {}) }); }
 for (const opening of structure.openings) vertices.push(...openingPoints(opening, structure.walls));
 for (const element of structure.elements ?? []) {
  if (exclude.has(element.id)) continue;
  vertices.push(...element.points); alignments.push(...element.points);
  element.points.slice(1).forEach((point, index) => edges.push({ start: element.points[index], end: point }));
  if (element.kind === 'object' && element.points.length > 2) edges.push({ start: element.points[element.points.length - 1], end: element.points[0] });
 }
 return { vertices, edges, alignments };
}
