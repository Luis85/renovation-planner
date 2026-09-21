import type { GeometryError } from '../../../core/errors/AppError';
import type { CircularEdge } from '../../../core/geometry/circularArc';
import { circularEdgeIntersections, curveTolerance } from '../../../core/geometry/circularIntersections';
import type { Point } from '../../../core/geometry/Point';
import type { Polygon } from '../../../core/geometry/Polygon';
import { err, type Result } from '../../../core/result/Result';
import { areaOutline } from './areaOutline';

/**
 * True when two of the outline's edges meet at a point INTERIOR to both — a proper crossing,
 * and nothing else.
 *
 * That one rule is deliberately narrower than "the edges touch anywhere they should not".
 * Every degenerate contact a real edit produces — a shared corner, a duplicated consecutive
 * vertex, a repeated closing point, two corners pinched onto each other, a doubled-back spike,
 * a redundant collinear midpoint, a collinear zero-area triple, a vertex landing exactly on
 * another edge — puts its contact point at an ENDPOINT of at least one of the two edges, so it
 * is accepted here. None of those makes a figure lie about itself: the shoelace sum over each
 * of them is still the area the outline encloses. A proper crossing is the one that does,
 * because a bowtie's signed area is the DIFFERENCE of its lobes — the wrong-numbers defect
 * this predicate exists for.
 *
 * Refusing collinearity here instead would close the zero-area drag as collateral, under a
 * self-intersection code, which is a policy change this module is not.
 *
 * **It judges CHORDS, not arcs.** Every door below carries points only; a curved zone's bulges
 * are re-attached downstream by `preservePointCurves`, so on a curved zone this reads the
 * straight chord between each pair of corners. Accepted deliberately: the silent-miss direction
 * (chords simple, arcs crossing) is still caught by core's `validateCurvedBoundary` once the
 * bulges are back on, and the false-refusal direction is rare and recoverable. This is not a
 * curve check.
 */
export function outlineCrosses(points: readonly Point[]): boolean {
	const epsilon = curveTolerance(points);
	const edges: readonly CircularEdge[] = points.map((start, index) => ({ start, end: points[(index + 1) % points.length], bulge: 0 }));
	const interior = (edge: CircularEdge, point: Point): boolean =>
		Math.hypot(point.x - edge.start.x, point.y - edge.start.y) > epsilon && Math.hypot(point.x - edge.end.x, point.y - edge.end.y) > epsilon;
	for (let first = 0; first < edges.length; first++) {
		for (let second = first + 1; second < edges.length; second++) {
			const [a, b] = [edges[first], edges[second]];
			if (circularEdgeIntersections(a, b).points.some(point => interior(a, point) && interior(b, point))) return true;
		}
	}
	return false;
}

/**
 * `areaOutline` and then the crossing rule, in that order: a collinear outline keeps its
 * `polygon-zero-area` code and nothing that reads that code moves.
 *
 * A door that must keep accepting a zero-area result composes `outlineCrosses` with
 * `createPolygon` itself instead of calling this. `SelectTool.commit` is such a door AND is
 * reached by a body drag, which is a rigid translation and so can neither create nor remove a
 * crossing; gating it there would newly refuse MOVING a zone that already crosses, so it is
 * deliberately not wired (measured, S13).
 *
 * WRITE-ONLY, like `areaOutline` itself — legacy Zone files remain readable unchanged, and a
 * vault already holding a crossing outline still loads, still draws and still bills wrongly.
 * The refusal surfaces however the door that called it already surfaces one; no door shows it
 * SPATIALLY (SDD §26's clause of that name is unmet here and this does not change it).
 */
export function simpleAreaOutline(points: readonly Point[]): Result<Polygon, GeometryError> {
	const outline = areaOutline(points);
	if (!outline.ok) return outline;
	if (outlineCrosses(points)) return err({ category: 'Geometry', code: 'polygon-self-intersection', message: 'An outline may not cross itself.' });
	return outline;
}
