import { distance, project } from '../../../core/geometry/operations';
import { isOk } from '../../../core/result/Result';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { LineSegment } from '../../../core/geometry/LineSegment';
import type { Point } from '../../../core/geometry/Point';

/**
 * Editor preferences (SDD §15 — settings, not persistent domain data) that parameterize
 * snapping. Injected once through the constructor, which is what makes `SnapService`
 * unit-testable without a live canvas, a store, or a Konva node.
 */
export interface SnapServiceConfig {
	readonly gridSpacingMm: number;
	readonly toleranceMm: number;
	readonly angleStepRadians: number;
}

/**
 * Candidate geometry a calling tool supplies, sourced from the active plan's
 * already-loaded zones (`EditorContext.activePlan`). `SnapService` never queries for
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
 * increases downward in this codebase (`worldToScreen` is `(p - pan) * scale`, and the
 * default pan is negative — slice 5), so "north" is `min.y` and "south" is `max.y`, the
 * opposite of a screen-up mental model. This mapping is a resolution made for this task
 * (see task-5-report.md), not something the brief or the SDD states outright.
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
	constructor(private readonly config: SnapServiceConfig) {}

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
	 * Snaps only the handle-moved edges of `box` to the grid — a corner handle moves two
	 * edges, an edge handle moves one — via `HANDLE_EDGES`. Every other edge is copied
	 * through unchanged.
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
		return { min, max };
	}
}
