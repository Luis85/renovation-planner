import { distance, project } from '../../../core/geometry/operations';
import { isOk } from '../../../core/result/Result';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';

/**
 * Editor preferences (SDD §15 — settings, not persistent domain data) that parameterize
 * snapping. Injected once through the constructor, which is what makes `SnapService`
 * unit-testable without a live canvas, a store, or a Konva node.
 *
 * `gridSpacingMm` and `angleStepRadians` are divisors inside `SnapService` (every
 * "round to nearest step" call is `Math.round(value / step) * step`), so the
 * constructor enforces both positive and finite — a zero or non-finite step would
 * otherwise silently produce `NaN`/`Infinity` coordinates out of every method that
 * touches the grid or rotation. `toleranceMm` is not enforced the same way: it is only
 * ever compared (`d <= tolerance`), never divided by, so a zero or negative value is
 * merely "snap nothing," not a NaN hazard, and is left as the caller's choice.
 */
export interface SnapServiceConfig {
	readonly gridSpacingMm: number;
	readonly toleranceMm: number;
	readonly angleStepRadians: number;
}

/** Throws for a value that would divide as zero, negative, `NaN`, or `Infinity`. */
function requirePositiveFinite(value: number, field: string): void {
	if (!Number.isFinite(value)) {
		throw new TypeError(`SnapServiceConfig.${field} must be finite; got ${value}.`);
	}
	if (value <= 0) {
		throw new RangeError(`SnapServiceConfig.${field} must be positive; got ${value}.`);
	}
}

/**
 * Candidate geometry a calling tool supplies, sourced from the active plan's
 * already-loaded zones (`EditorContext.subject`). `SnapService` never queries for
 * this itself — it only ever ranks what it is handed.
 */
export interface SnapCandidates {
	readonly vertices?: readonly Point[];
	readonly edges?: readonly LineSegment[];
}

export type TransformerHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

type BoxEdge = 'minX' | 'minY' | 'maxX' | 'maxY';

/**
 * Which axis-aligned edges of a `BoundingBox` each Transformer handle moves. World Y
 * increases downward in this codebase: `Viewport.ts`'s `worldToScreen` computes
 * `screen.y = (point.y - pan.y) * scale` with no sign flip on the Y term, and `scale`
 * (`zoom * dpr`) is always positive — `zoom` is clamped to `[0.01, 20]`. Pan only
 * translates the origin; its sign changes neither that multiplication nor the
 * direction relationship. So increasing world Y always maps to increasing screen Y,
 * making "north" `min.y` and "south" `max.y` — the opposite of a screen-up mental
 * model. This mapping is a resolution made for this task — the reasoning above is
 * the whole of it — not something
 * `docs/tasks/06-editor-tool-framework-undo-redo-and-inspector.md` or the SDD states
 * outright.
 */
const HANDLE_EDGES: Readonly<Record<TransformerHandle, readonly BoxEdge[]>> = {
	nw: ['minX', 'minY'],
	n: ['minY'],
	ne: ['maxX', 'minY'],
	e: ['maxX'],
	se: ['maxX', 'maxY'],
	s: ['maxY'],
	sw: ['minX', 'maxY'],
	w: ['minX'],
};

function roundToStep(value: number, step: number): number {
	return Math.round(value / step) * step;
}

/**
 * How near a direction component must be to `0` or `±1` to be treated as exactly that.
 * Twelve orders of magnitude below a millimetre and four above the dust being cleaned, so
 * it can only ever catch a representation error: the nearest real coordinates are the
 * sub-nanometre ones no pointer, at any zoom this editor allows, can express.
 */
const AXIS_EPSILON = 1e-12;

/**
 * One component of a snapped direction, with `Math.cos`/`Math.sin`'s representation error
 * removed.
 *
 * A snapped angle is by construction an exact multiple of the step, so when that multiple
 * lands on an axis the direction IS exactly `(±1, 0)` or `(0, ±1)` — but `Math.sin(Math.PI)`
 * is `1.22e-16`, not `0`. Left in, that dust travels: a Shift-constrained horizontal line
 * comes out 1.2e-14 mm off horizontal, and — the way it was actually found — a constrained
 * click back onto an existing vertex lands 1.2e-14 mm beside it, slips through
 * `DrawPolygonTool`'s exact-equality duplicate guard, and gives the polygon the zero-length
 * edge that guard exists to refuse. `createPolygon` would not catch it either: it validates
 * the count and finiteness of the coordinates, both of which a sliver satisfies.
 *
 * Correcting a representation error rather than fudging a value: this returns the number the
 * arithmetic was always trying to produce. Angles that are NOT axis multiples are irrational
 * in both components and pass through untouched, because for those there is no exact value to
 * restore. Reported by a review bot on the pull request that added the constraint.
 */
function exactOnAxis(value: number): number {
	if (Math.abs(value) < AXIS_EPSILON) return 0;
	if (Math.abs(Math.abs(value) - 1) < AXIS_EPSILON) return Math.sign(value);
	return value;
}

/**
 * Nearest of `candidates` to `point`, within `tolerance`, else `null`. `toPoint` maps a
 * candidate to the point actually being measured against — identity for a vertex, a
 * clamped projection for an edge — and may answer `null` to exclude a candidate outright
 * (how `snapToEdge` drops a degenerate segment rather than dividing by its squared
 * length).
 *
 * Ties: `d < bestDistance` only replaces a STRICTLY closer candidate, so on an exact
 * distance tie the first candidate at that distance, in iteration order, wins. That is a
 * property of iteration order, not of the geometry — deterministic, but arbitrary by
 * design, and the tests pin it by asserting the winner flips when the same two
 * candidates are passed in reverse order.
 */
function nearestWithinTolerance<T>(
	point: Point,
	candidates: readonly T[],
	toPoint: (candidate: T) => Point | null,
	tolerance: number,
): Point | null {
	let best: Point | null = null;
	let bestDistance = Infinity;
	for (const candidate of candidates) {
		const candidatePoint = toPoint(candidate);
		if (candidatePoint === null) {
			continue;
		}
		const d = distance(point, candidatePoint);
		if (d <= tolerance && d < bestDistance) {
			bestDistance = d;
			best = candidatePoint;
		}
	}
	return best;
}

/**
 * The one editor-level snapping service (SDD §21), implemented once rather than
 * per-tool. A tool calls `snapPoint` during both `pointerMove` (the snapped preview
 * written to render state) and `pointerUp` (the committed point) — always the same
 * function, so a drag's preview can never drift from what actually gets committed.
 *
 * Nothing here reads a store, a repository, or a Konva node: grid spacing, tolerance and
 * angle step arrive once through `config`, and candidate geometry arrives as a plain
 * argument on every call.
 */
export class SnapService {
	constructor(private readonly config: SnapServiceConfig) {
		requirePositiveFinite(config.gridSpacingMm, 'gridSpacingMm');
		requirePositiveFinite(config.angleStepRadians, 'angleStepRadians');
	}

	snapToGrid(point: Point): Point {
		return {
			x: roundToStep(point.x, this.config.gridSpacingMm),
			y: roundToStep(point.y, this.config.gridSpacingMm),
		};
	}

	snapToVertex(point: Point, candidates: readonly Point[]): Point | null {
		return nearestWithinTolerance(point, candidates, (candidate) => candidate, this.config.toleranceMm);
	}

	/**
	 * Nearest point ON a segment — the foot of the perpendicular, clamped to the
	 * segment's endpoints, never a point on its infinite extension.
	 *
	 * A degenerate (zero-length) segment is excluded as a candidate rather than
	 * producing `NaN`: `project` (`core/geometry/operations.ts`) already answers `err`
	 * for one, since "the nearest point on nothing" is undefined the same way dividing
	 * by a zero squared-length is — this reuses that answer instead of re-deriving a
	 * second zero-length check here.
	 */
	snapToEdge(point: Point, candidates: readonly LineSegment[]): Point | null {
		return nearestWithinTolerance(
			point,
			candidates,
			(segment) => {
				const projected = project(point, segment);
				return isOk(projected) ? projected.value : null;
			},
			this.config.toleranceMm,
		);
	}

	/**
	 * Precedence, NOT nearest-wins: a vertex within tolerance always wins over an edge
	 * within tolerance, even one strictly closer to `point` than the vertex is. The SDD
	 * states the order as vertex > edge > the original point, and that is what this
	 * implements — a reader expecting "whichever candidate is closest overall" would be
	 * wrong, and a test pins the precedence case where the edge is nearer and still
	 * loses.
	 */
	snapPoint(point: Point, candidates: SnapCandidates): Point {
		const vertex = this.snapToVertex(point, candidates.vertices ?? []);
		if (vertex !== null) {
			return vertex;
		}
		const edge = this.snapToEdge(point, candidates.edges ?? []);
		return edge ?? point;
	}

	snapRotation(angleRadians: number): number {
		return roundToStep(angleRadians, this.config.angleStepRadians);
	}

	/**
	 * `point` pulled onto the nearest ray of `angleStepRadians` leaving `anchor` — the Shift
	 * constraint both drawing tools offer, so a wall can be drawn straight without the user
	 * hitting the exact pixel.
	 *
	 * **Projected onto the ray, not rotated onto it.** The result is the pointer's distance
	 * ALONG the constrained direction, which is the convention CAD polar tracking established:
	 * the picked point lands on the alignment path at the distance indicated. At the editor's
	 * 15 degree step the two differ by at most `1 - cos(7.5°)`, under 1%, so this choice is
	 * about being right rather than about being visible.
	 *
	 * Two properties the arithmetic does not give for free, both pinned by tests:
	 *
	 * - A pointer ON the anchor answers the anchor. It has no bearing, and `atan2(0, 0)` is
	 *   `0` rather than `NaN`, so the natural reading would be "due east" — a direction the
	 *   user never indicated, drawn out of a click that has not moved.
	 * - An axis-aligned constraint answers EXACT coordinates. See `exactOnAxis`: without it a
	 *   constrained horizontal is 1.2e-14 mm off horizontal, and a constrained click back onto
	 *   an existing vertex lands just beside it rather than on it — which is a zero-length
	 *   polygon edge that every exact-equality guard downstream waves through.
	 * - The point is never placed BEHIND the anchor. With any step up to a half turn the
	 *   nearest direction is within half a step of the true bearing, so the projection is
	 *   forward on its own; a coarser step is what breaks that, and a mirrored point would be
	 *   a straight line drawn in the direction the user is not pointing.
	 */
	snapDirection(anchor: Point, point: Point): Point {
		const dx = point.x - anchor.x;
		const dy = point.y - anchor.y;
		if (dx === 0 && dy === 0) {
			return anchor;
		}
		const angle = this.snapRotation(Math.atan2(dy, dx));
		const direction = { x: exactOnAxis(Math.cos(angle)), y: exactOnAxis(Math.sin(angle)) };
		const along = Math.max(0, dx * direction.x + dy * direction.y);
		return { x: anchor.x + direction.x * along, y: anchor.y + direction.y * along };
	}

	/**
	 * Snaps only the handle-moved edges of `box` to the grid — a corner handle moves two
	 * edges, an edge handle moves one — via `HANDLE_EDGES`. Every other edge is copied
	 * through unchanged.
	 *
	 * The returned box is **always ordered** (`min <= max` on both axes), which rounding
	 * alone does not guarantee: a box already narrower than one grid step can have its moved
	 * edge rounded PAST the opposite one — handle `'e'` on a box 30mm wide under a 100mm
	 * grid rounds `max.x` down toward `min.x` and through it — leaving `max < min`.
	 * `BoundingBox` carries no invariant that refuses that and `createPolygon` accepts the
	 * inverted polygon it becomes, so the inversion would survive all the way to a persisted,
	 * mirrored zone. Ordering here is the same answer
	 * `selection/normalize-transform.ts` gives a flipped Transformer scale, for the same
	 * reason.
	 */
	snapResize(box: BoundingBox, handle: TransformerHandle): BoundingBox {
		const min = { x: box.min.x, y: box.min.y };
		const max = { x: box.max.x, y: box.max.y };
		for (const edge of HANDLE_EDGES[handle]) {
			switch (edge) {
				case 'minX':
					min.x = roundToStep(min.x, this.config.gridSpacingMm);
					break;
				case 'minY':
					min.y = roundToStep(min.y, this.config.gridSpacingMm);
					break;
				case 'maxX':
					max.x = roundToStep(max.x, this.config.gridSpacingMm);
					break;
				case 'maxY':
					max.y = roundToStep(max.y, this.config.gridSpacingMm);
					break;
			}
		}
		// Ordered rather than returned as rounded — see this method's doc comment. `Math.min`/
		// `Math.max` rather than a sign test, so the ordinary case and the collapsed one run
		// exactly the same code.
		return {
			min: { x: Math.min(min.x, max.x), y: Math.min(min.y, max.y) },
			max: { x: Math.max(min.x, max.x), y: Math.max(min.y, max.y) },
		};
	}
}
