import type { Point } from '../../../core/geometry/Point';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Structure } from '../../../domain/spatial/Structure';
import { openingPoints } from '../../../domain/spatial/Structure';
import type { SnapCandidates } from './snap-service';
/** Existing zone boundaries and wall centre lines; this projection never changes ownership. */
export function roomSnapCandidates(zones: Iterable<{ readonly points: readonly Point[] }>, structure: Structure): SnapCandidates {
 const vertices: Point[] = [], edges: LineSegment[] = [];
 for (const zone of zones) {
  vertices.push(...zone.points);
  if (zone.points.length < 2) continue;
  zone.points.forEach((point, index) => edges.push({ start: point, end: zone.points[(index + 1) % zone.points.length] }));
 }
 for (const wall of structure.walls) { vertices.push(wall.start, wall.end); edges.push({ start: wall.start, end: wall.end }); }
 for (const opening of structure.openings) vertices.push(...openingPoints(opening, structure.walls));
 for (const element of structure.elements ?? []) {
  vertices.push(...element.points);
  element.points.slice(1).forEach((point, index) => edges.push({ start: element.points[index], end: point }));
  if (element.kind === 'object' && element.points.length > 2) edges.push({ start: element.points[element.points.length - 1], end: element.points[0] });
 }
 return { vertices, edges };
}
