import { distance, extentOf, project } from '../../../core/geometry/operations';
import { isOk } from '../../../core/result/Result';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import { arcProjection } from '../../../core/geometry/circularArc';

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
	readonly edges?: readonly (LineSegment & { readonly bulge?: number })[];
	/**
	 * Every point whose x or y is worth lining up with — a neighbour's vertices and box
	 * centres. Read by the axis-alignment stage only, after vertex and edge have declined.
	 */
	readonly alignments?: readonly Point[];
}

/** A snapped point and the guide segments that say why it landed there. */
export interface SnapResult {
	readonly point: Point;
	readonly guides: LineSegment[];
}

/** The extra vector a body move applies to EVERY point, and the guides that say why. */
export interface TranslationSnap {
	readonly correction: Vector;
	readonly guides: LineSegment[];
}

const NO_TRANSLATION: TranslationSnap = { correction: { dx: 0, dy: 0 }, guides: [] };

/** The nearest (moving point, landing) pair `land` answers within tolerance, else `null`. */
function nearestPair(moving: readonly Point[], land: (from: Point) => Point | null): { from: Point; to: Point } | null {
	let best: { from: Point; to: Point } | null = null;
	let bestDistance = Infinity;
	for (const from of moving) {
		const to = land(from);
		if (to === null) continue;
		const d = distance(from, to);
		if (d < bestDistance) {
			bestDistance = d;
			best = { from, to };
		}
	}
	return best;
}

/** The moving feature and alignment with the smallest |delta| on `axis` within tolerance. */
function nearestAxisMatch(features: readonly Point[], alignments: readonly Point[], axis: 'x' | 'y', tolerance: number): { feature: Point; to: Point; delta: number } | null {
	let best: { feature: Point; to: Point; delta: number } | null = null;
	for (const feature of features) {
		const to = nearestAlignment(feature[axis], alignments, axis, tolerance);
		if (to === null) continue;
		const delta = to[axis] - feature[axis];
		if (best === null || Math.abs(delta) < Math.abs(best.delta)) best = { feature, to, delta };
	}
	return best;
}

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
 * The alignment whose `axis` coordinate is nearest `value` within `tolerance`, else `null`.
 * Strictly-closer wins, so a tie keeps the first in iteration order — the same rule
 * `nearestWithinTolerance` pins for points.
 */
function nearestAlignment(value: number, alignments: readonly Point[], axis: 'x' | 'y', tolerance: number): Point | null {
	let best: Point | null = null;
	let bestDistance = Infinity;
	for (const candidate of alignments) {
		const d = Math.abs(candidate[axis] - value);
		if (d <= tolerance && d < bestDistance) {
			bestDistance = d;
			best = candidate;
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
	constructor(private readonly config: SnapServiceConfig, private readonly isEnabled: () => boolean = () => true) {
		requirePositiveFinite(config.gridSpacingMm, 'gridSpacingMm');
		requirePositiveFinite(config.angleStepRadians, 'angleStepRadians');
	}

	/** Per-surface automatic object alignment; explicit Shift constraints remain available. */
	get enabled(): boolean { return this.isEnabled(); }

	snapToVertex(point: Point, candidates: readonly Point[], toleranceMm = this.config.toleranceMm): Point | null {
		if (!this.enabled) return null;
		return nearestWithinTolerance(point, candidates, (candidate) => candidate, toleranceMm);
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
	snapToEdge(point: Point, candidates: readonly (LineSegment & { readonly bulge?: number })[], toleranceMm = this.config.toleranceMm): Point | null {
		if (!this.enabled) return null;
		return nearestWithinTolerance(
			point,
			candidates,
			(segment) => {
				if (segment.bulge) return distance(segment.start, segment.end) === 0 ? null : arcProjection({ ...segment, bulge: segment.bulge }, point).point;
				const projected = project(point, segment);
				return isOk(projected) ? projected.value : null;
			},
			toleranceMm,
		);
	}

	/**
	 * `snapPoint` with the reason attached. Precedence, NOT nearest-wins: a vertex within
	 * tolerance always wins over an edge within tolerance, even one strictly closer to `point`
	 * than the vertex is, and either wins over an axis alignment. The order is vertex > edge >
	 * axis alignment > the original point (spec §3.2) — a reader expecting "whichever
	 * candidate is closest overall" would be wrong, and tests pin the precedence cases where
	 * the later stage is nearer and still loses.
	 *
	 * The first two answer one guide from the pointer to where it landed; the axis stage
	 * decides x and y independently and answers one guide PER AXIS that fired, from the landed
	 * point to the alignment it matched — which is axis-aligned by construction, and is what
	 * the canvas draws as the dashed "lined up with" line.
	 *
	 * When no stage fires the answer is `point` ITSELF, not an equal copy: callers pin
	 * `snapPoint`'s no-snap answer with `toBe`, and a `landed` object built unconditionally
	 * turned them red — measured, not guessed.
	 */
	snapPointWithGuides(point: Point, candidates: SnapCandidates, toleranceMm = this.config.toleranceMm): SnapResult {
		if (!this.enabled) return { point, guides: [] };
		const vertex = this.snapToVertex(point, candidates.vertices ?? [], toleranceMm);
		if (vertex !== null) return { point: vertex, guides: [{ start: point, end: vertex }] };
		const edge = this.snapToEdge(point, candidates.edges ?? [], toleranceMm);
		if (edge !== null) return { point: edge, guides: [{ start: point, end: edge }] };
		const alignments = candidates.alignments ?? [];
		const alongX = nearestAlignment(point.x, alignments, 'x', toleranceMm);
		const alongY = nearestAlignment(point.y, alignments, 'y', toleranceMm);
		if (alongX === null && alongY === null) return { point, guides: [] };
		const landed = { x: alongX?.x ?? point.x, y: alongY?.y ?? point.y };
		const guides: LineSegment[] = [];
		if (alongX !== null) guides.push({ start: landed, end: alongX });
		if (alongY !== null) guides.push({ start: landed, end: alongY });
		return { point: landed, guides };
	}

	snapPoint(point: Point, candidates: SnapCandidates, toleranceMm = this.config.toleranceMm): Point {
		return this.snapPointWithGuides(point, candidates, toleranceMm).point;
	}

	/**
	 * A body move's snap (spec §3.3). `moving` is the shape ALREADY translated by the raw
	 * pointer delta; the answer is one more vector to add to every point, so a move stays a
	 * translation and can never deform the shape. Stages, in precedence: the nearest moving
	 * vertex to a candidate vertex; the nearest moving vertex to an edge; then per axis, the
	 * smallest delta between any moving FEATURE (its vertices plus the box centre — a box's
	 * min and max on an axis are already some vertex's coordinate) and any alignment
	 * coordinate. Guides: the point stages draw pre-correction vertex → landing; the axis
	 * stage draws the corrected feature → alignment, which is a straight axis-aligned line.
	 */
	snapTranslation(moving: readonly Point[], candidates: SnapCandidates, toleranceMm = this.config.toleranceMm): TranslationSnap {
		if (!this.enabled || moving.length === 0) return NO_TRANSLATION;
		const pair = nearestPair(moving, (from) => this.snapToVertex(from, candidates.vertices ?? [], toleranceMm))
			?? nearestPair(moving, (from) => this.snapToEdge(from, candidates.edges ?? [], toleranceMm));
		if (pair !== null) {
			return { correction: { dx: pair.to.x - pair.from.x, dy: pair.to.y - pair.from.y }, guides: [{ start: pair.from, end: pair.to }] };
		}
		const alignments = candidates.alignments ?? [];
		const { minX, maxX, minY, maxY } = extentOf(moving);
		const features = [...moving, { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }];
		const alongX = nearestAxisMatch(features, alignments, 'x', toleranceMm);
		const alongY = nearestAxisMatch(features, alignments, 'y', toleranceMm);
		const correction: Vector = { dx: alongX?.delta ?? 0, dy: alongY?.delta ?? 0 };
		const guides: LineSegment[] = [];
		if (alongX !== null) guides.push({ start: { x: alongX.feature.x + correction.dx, y: alongX.feature.y + correction.dy }, end: alongX.to });
		if (alongY !== null) guides.push({ start: { x: alongY.feature.x + correction.dx, y: alongY.feature.y + correction.dy }, end: alongY.to });
		return { correction, guides };
	}

	snapRotation(angleRadians: number): number {
		return roundToStep(angleRadians, this.config.angleStepRadians);
	}
	/** The same configured increment shown by the rotation feedback. */
	rotationStepDegrees(): number { return this.config.angleStepRadians * 180 / Math.PI; }

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
}
