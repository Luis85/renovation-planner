import type { GeometryError } from '../../../core/errors/AppError';
import type { CircularEdge } from '../../../core/geometry/circularArc';
import { circularEdgeIntersections, curveTolerance } from '../../../core/geometry/circularIntersections';
import type { Point } from '../../../core/geometry/Point';
import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
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
 * **"At an endpoint" is `curveTolerance(points)`, not zero, and that is load-bearing.** Two
 * adjacent edges of an honest outline can report their SHARED corner a hair off itself —
 * measured at 1.14e-13 mm, against an epsilon of 1e-7 — so forcing the epsilon to 0, or
 * spelling `> 0`, refuses a real plan. `simpleOutline.test.ts` carries that fixture. The cost
 * in the other direction is a corner dragged 1e-8 mm past the opposite edge being accepted,
 * which is a ~1e-16 mm² area error and correct rather than a miss worth closing.
 *
 * **It judges CHORDS, not arcs.** Every door below carries points only; a curved zone's bulges
 * are re-attached downstream by `preservePointCurves`, so on a curved zone this reads the
 * straight chord between each pair of corners. Accepted deliberately: the silent-miss direction
 * (chords simple, arcs crossing) is caught by core's `validateCurvedBoundary` once the bulges
 * are back on — driven at CORE by `simpleOutline.test.ts`'s rectangle whose two opposed
 * semicircles each rise 500 mm into an 800 mm gap, which this predicate accepts and
 * `createCurvedPolygon` refuses under `curve-self-intersection`. What is NOT driven is the
 * route: no case hands a curved outline through `preservePointCurves` into
 * `createCurvedPolygon` in one go. The false-refusal direction is rare and recoverable. This
 * is not a curve check. Note also that door 4's `SpatialElement`s carry no bulges at all, so
 * for that door the compensating mechanism is vacuous rather than reached.
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
 * `createPolygon` and then the crossing rule, and NOTHING about area: the door that must keep
 * accepting a zero-area outline takes this one. `SelectTool.commit` is that door on its vertex
 * arm — L-23, the zero-area vertex drag, is a policy question this module is not.
 *
 * WRITE-ONLY, like `areaOutline` itself — legacy Zone files remain readable unchanged, and a
 * vault already holding a crossing outline still loads, still draws and still bills wrongly.
 * The refusal surfaces however the door that called it already surfaces one; no door shows it
 * SPATIALLY (SDD §26's clause of that name is unmet here and this does not change it).
 */
export function crossingFreeOutline(points: readonly Point[]): Result<Polygon, GeometryError> {
	const polygon = createPolygon(points);
	if (!polygon.ok) return polygon;
	if (outlineCrosses(points)) return err({ category: 'Geometry', code: 'polygon-self-intersection', message: 'An outline may not cross itself.' });
	return polygon;
}

/**
 * `areaOutline` FIRST and then the crossing rule. Every door that already required a
 * measurable surface takes this one.
 *
 * The order decides which refusal wins whenever an outline would fail BOTH steps — that is,
 * whenever `createPolygon` succeeds, `areaOutline` still refuses, and the outline also crosses:
 * `areaOutline`'s code here, `polygon-self-intersection` with the two steps swapped. Two codes
 * of `areaOutline`'s reach that state, so there are two such families rather than the one this
 * docblock claimed for one commit: `polygon-zero-area`, and `area`'s `polygon-area-overflow`
 * (`operations.ts` — finite vertices whose enclosed area is not representable, which
 * `createPolygon` accepts because it refuses only NON-finite coordinates). Every code
 * `createPolygon` itself raises is order-invariant, since both steps begin with it.
 * `simpleOutline.test.ts` pins a fixture for each family; the sentence is not wider than that.
 * It is NOT what keeps a merely collinear outline on its
 * `polygon-zero-area` code — this docblock said that for two commits and it was false.
 * `outlineCrosses` accepts every collinear outline by construction, so those answer the same
 * either way, and swapping the steps left 76 test files and 997 tests green until
 * `simpleOutline.test.ts` grew the discriminating fixture `[(0,0),(4000,0),(4000,3000),(0,-3000)]`.
 */
export function simpleAreaOutline(points: readonly Point[]): Result<Polygon, GeometryError> {
	const outline = areaOutline(points);
	return outline.ok ? crossingFreeOutline(points) : outline;
}
