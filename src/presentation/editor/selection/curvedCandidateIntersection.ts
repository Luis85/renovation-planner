import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { contains } from '../../../core/geometry/operations';
import { circularEdgeIntersections } from '../../../core/geometry/circularIntersections';
import type { SpatialObjectCandidate } from '../tools/select-tool';

/** Analytic arc/rectangle crossings; a sampling gap cannot omit a thin marquee hit. */
export function curvedCandidateIntersection(candidate: SpatialObjectCandidate, box: BoundingBox): boolean {
	const corners = [box.min, { x: box.max.x, y: box.min.y }, box.max, { x: box.min.x, y: box.max.y }];
	const closed = candidate.kind === undefined || candidate.kind === 'object';
	if (candidate.points.some(point => point.x >= box.min.x && point.x <= box.max.x && point.y >= box.min.y && point.y <= box.max.y)) return true;
	if (closed) { const inside = contains(candidate, box.min); if (inside.ok && inside.value) return true; }
	return candidate.points.slice(0, closed ? candidate.points.length : -1).some((start, index) => {
		const edge = { start, end: candidate.points[(index + 1) % candidate.points.length], bulge: candidate.bulges?.[index] ?? 0 };
		return corners.some((point, cornerIndex) => { const hit = circularEdgeIntersections(edge, { start: point, end: corners[(cornerIndex + 1) % corners.length], bulge: 0 }); return hit.overlap || hit.points.length > 0; });
	});
}
