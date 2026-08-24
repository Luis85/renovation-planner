/**
 * `SnapService` (SDD §21, design slice 6): grid, vertex, edge and combined point
 * snapping, plus rotation and per-handle resize snapping — all as pure functions over
 * injected config and caller-supplied candidate geometry, no live canvas involved.
 */
import { describe, it, expect } from 'vitest';
import { SnapService } from '../../../../src/presentation/editor/snapping/snap-service';
import type { Point } from '../../../../src/core/geometry/Point';
import type { LineSegment } from '../../../../src/core/geometry/LineSegment';
import type { BoundingBox } from '../../../../src/core/geometry/BoundingBox';

const GRID = 100;
const TOLERANCE = 15;

function makeService(overrides: Partial<{ gridSpacingMm: number; toleranceMm: number; angleStepRadians: number }> = {}): SnapService {
	return new SnapService({
		gridSpacingMm: overrides.gridSpacingMm ?? GRID,
		toleranceMm: overrides.toleranceMm ?? TOLERANCE,
		angleStepRadians: overrides.angleStepRadians ?? Math.PI / 2,
	});
}

describe('SnapService.snapToGrid', () => {
	it('leaves a point already on the grid unchanged', () => {
		const service = makeService();
		expect(service.snapToGrid({ x: 200, y: 300 })).toEqual({ x: 200, y: 300 });
	});

	it('rounds down when below the midpoint of the grid cell', () => {
		const service = makeService();
		expect(service.snapToGrid({ x: 240, y: 0 })).toEqual({ x: 200, y: 0 });
	});

	it('rounds up when above the midpoint of the grid cell', () => {
		const service = makeService();
		expect(service.snapToGrid({ x: 260, y: 0 })).toEqual({ x: 300, y: 0 });
	});

	it('rounds each axis independently', () => {
		const service = makeService();
		expect(service.snapToGrid({ x: 240, y: 260 })).toEqual({ x: 200, y: 300 });
	});

	it('rounds negative coordinates toward the nearer grid line', () => {
		const service = makeService();
		expect(service.snapToGrid({ x: -240, y: -260 })).toEqual({ x: -200, y: -300 });
	});

	it('rounds an exact half-cell up (Math.round convention)', () => {
		const service = makeService();
		expect(service.snapToGrid({ x: 250, y: 0 })).toEqual({ x: 300, y: 0 });
	});
});

describe('SnapService.snapToVertex', () => {
	it('returns null when there are no candidates', () => {
		const service = makeService();
		expect(service.snapToVertex({ x: 0, y: 0 }, [])).toBeNull();
	});

	it('snaps to a candidate just inside tolerance', () => {
		const service = makeService();
		const candidate: Point = { x: 14.9, y: 0 };
		expect(service.snapToVertex({ x: 0, y: 0 }, [candidate])).toEqual(candidate);
	});

	it('does not snap to a candidate just outside tolerance', () => {
		const service = makeService();
		const candidate: Point = { x: 15.1, y: 0 };
		expect(service.snapToVertex({ x: 0, y: 0 }, [candidate])).toBeNull();
	});

	it('picks the nearest of several candidates within tolerance', () => {
		const service = makeService();
		const near: Point = { x: 5, y: 0 };
		const far: Point = { x: 12, y: 0 };
		expect(service.snapToVertex({ x: 0, y: 0 }, [far, near])).toEqual(near);
	});

	it('ignores an out-of-tolerance candidate even when it is the only one', () => {
		const service = makeService();
		expect(service.snapToVertex({ x: 0, y: 0 }, [{ x: 1000, y: 1000 }])).toBeNull();
	});

	it('breaks an exact distance tie by returning the earlier candidate', () => {
		const service = makeService();
		const first: Point = { x: 10, y: 0 };
		const second: Point = { x: -10, y: 0 };
		expect(service.snapToVertex({ x: 0, y: 0 }, [first, second])).toEqual(first);
		// Confirm the tie rule is about order, not value: reversing the array flips the winner.
		expect(service.snapToVertex({ x: 0, y: 0 }, [second, first])).toEqual(second);
	});
});

describe('SnapService.snapToEdge', () => {
	const horizontal: LineSegment = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };

	it('returns null when there are no candidates', () => {
		const service = makeService();
		expect(service.snapToEdge({ x: 50, y: 5 }, [])).toBeNull();
	});

	it('snaps to the perpendicular foot when it falls within the segment', () => {
		const service = makeService();
		expect(service.snapToEdge({ x: 50, y: 10 }, [horizontal])).toEqual({ x: 50, y: 0 });
	});

	it('does not snap when the perpendicular distance exceeds tolerance', () => {
		const service = makeService();
		expect(service.snapToEdge({ x: 50, y: 20 }, [horizontal])).toBeNull();
	});

	it('clamps the projection to the nearer endpoint rather than the infinite line', () => {
		// The unclamped foot of the perpendicular from (105, 5) onto the LINE through
		// (0,0)-(100,0) is (105, 0) — off the segment, and 5mm from the probe (would
		// wrongly pass tolerance). The correct, clamped answer is the endpoint (100, 0),
		// 7.07mm away. A wrong implementation that forgets to clamp returns (105, 0).
		const service = makeService();
		expect(service.snapToEdge({ x: 105, y: 5 }, [horizontal])).toEqual({ x: 100, y: 0 });
	});

	it('rejects a point whose clamped nearest point falls outside tolerance', () => {
		// Same segment, further along: the clamped nearest point is still (100, 0), but
		// now 30mm+ from the probe — outside tolerance even though the unclamped,
		// off-segment foot would have been close enough.
		const service = makeService();
		expect(service.snapToEdge({ x: 130, y: 2 }, [horizontal])).toBeNull();
	});

	it('excludes a degenerate (zero-length) segment rather than producing NaN', () => {
		const service = makeService();
		const degenerate: LineSegment = { start: { x: 5, y: 5 }, end: { x: 5, y: 5 } };
		const result = service.snapToEdge({ x: 5, y: 6 }, [degenerate]);
		expect(result).toBeNull();
		expect(result === null || (Number.isFinite(result.x) && Number.isFinite(result.y))).toBe(true);
	});

	it('skips a degenerate segment and still snaps to a valid one in the same list', () => {
		const service = makeService();
		const degenerate: LineSegment = { start: { x: 5, y: 5 }, end: { x: 5, y: 5 } };
		expect(service.snapToEdge({ x: 50, y: 1 }, [degenerate, horizontal])).toEqual({ x: 50, y: 0 });
	});

	it('picks the nearest of several candidate edges within tolerance', () => {
		const service = makeService();
		const near: LineSegment = { start: { x: 40, y: 5 }, end: { x: 60, y: 5 } };
		const far: LineSegment = { start: { x: 40, y: 12 }, end: { x: 60, y: 12 } };
		expect(service.snapToEdge({ x: 50, y: 0 }, [far, near])).toEqual({ x: 50, y: 5 });
	});

	it('breaks an exact distance tie by returning the earlier candidate', () => {
		const service = makeService();
		const first: LineSegment = { start: { x: 10, y: -5 }, end: { x: 10, y: 5 } };
		const second: LineSegment = { start: { x: -10, y: -5 }, end: { x: -10, y: 5 } };
		expect(service.snapToEdge({ x: 0, y: 0 }, [first, second])).toEqual({ x: 10, y: 0 });
		expect(service.snapToEdge({ x: 0, y: 0 }, [second, first])).toEqual({ x: -10, y: 0 });
	});
});

describe('SnapService.snapPoint', () => {
	it('returns the original point when nothing is within tolerance', () => {
		const service = makeService();
		const point: Point = { x: 500, y: 500 };
		expect(service.snapPoint(point, {})).toEqual(point);
	});

	it('falls back to edge snapping when no vertex is within tolerance', () => {
		const service = makeService();
		const edge: LineSegment = { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };
		expect(service.snapPoint({ x: 50, y: 10 }, { edges: [edge] })).toEqual({ x: 50, y: 0 });
	});

	it('prefers a vertex over a strictly closer edge — precedence, not nearest-wins', () => {
		// Vertex at the origin is 14.14mm from the probe (within tolerance). The edge's
		// projected point is only 10mm away — nearer — but must lose anyway, because the
		// rule is vertex > edge, not "whichever candidate is closer".
		const service = makeService();
		const vertex: Point = { x: 0, y: 0 };
		const edge: LineSegment = { start: { x: 0, y: 20 }, end: { x: 100, y: 20 } };
		const result = service.snapPoint(
			{ x: 10, y: 10 },
			{ vertices: [vertex], edges: [edge] },
		);
		expect(result).toEqual(vertex);
	});

	it('never returns null', () => {
		const service = makeService();
		const result = service.snapPoint({ x: 12345, y: -6789 }, {});
		expect(result).not.toBeNull();
	});
});

describe('SnapService.snapRotation', () => {
	it('rounds down toward the nearer step multiple', () => {
		const service = makeService({ angleStepRadians: Math.PI / 2 });
		expect(service.snapRotation(Math.PI / 6)).toBeCloseTo(0, 10);
	});

	it('rounds up toward the nearer step multiple', () => {
		const service = makeService({ angleStepRadians: Math.PI / 2 });
		expect(service.snapRotation(Math.PI / 3)).toBeCloseTo(Math.PI / 2, 10);
	});

	it('leaves an exact multiple unchanged', () => {
		const service = makeService({ angleStepRadians: Math.PI / 2 });
		expect(service.snapRotation(Math.PI)).toBeCloseTo(Math.PI, 10);
	});

	it('rounds a negative angle toward the nearer step multiple', () => {
		const service = makeService({ angleStepRadians: Math.PI / 2 });
		expect(service.snapRotation(-1.2)).toBeCloseTo(-Math.PI / 2, 10);
	});
});

describe('SnapService.snapResize', () => {
	// Chosen so every coordinate actually moves under grid 100 — min rounds down to
	// (0, 0), max rounds down to (200, 200) — so a test that changes the wrong edge, or
	// none, produces a visibly different box rather than one that coincidentally matches.
	const box: BoundingBox = { min: { x: 12, y: 37 }, max: { x: 230, y: 172 } };

	it('nw moves both min edges, leaves max untouched', () => {
		const service = makeService();
		expect(service.snapResize(box, 'nw')).toEqual({ min: { x: 0, y: 0 }, max: { x: 230, y: 172 } });
	});

	it('n moves only min.y', () => {
		const service = makeService();
		expect(service.snapResize(box, 'n')).toEqual({ min: { x: 12, y: 0 }, max: { x: 230, y: 172 } });
	});

	it('ne moves max.x and min.y', () => {
		const service = makeService();
		expect(service.snapResize(box, 'ne')).toEqual({ min: { x: 12, y: 0 }, max: { x: 200, y: 172 } });
	});

	it('e moves only max.x', () => {
		const service = makeService();
		expect(service.snapResize(box, 'e')).toEqual({ min: { x: 12, y: 37 }, max: { x: 200, y: 172 } });
	});

	it('se moves both max edges, leaves min untouched', () => {
		const service = makeService();
		expect(service.snapResize(box, 'se')).toEqual({ min: { x: 12, y: 37 }, max: { x: 200, y: 200 } });
	});

	it('s moves only max.y', () => {
		const service = makeService();
		expect(service.snapResize(box, 's')).toEqual({ min: { x: 12, y: 37 }, max: { x: 230, y: 200 } });
	});

	it('sw moves min.x and max.y', () => {
		const service = makeService();
		expect(service.snapResize(box, 'sw')).toEqual({ min: { x: 0, y: 37 }, max: { x: 230, y: 200 } });
	});

	it('w moves only min.x', () => {
		const service = makeService();
		expect(service.snapResize(box, 'w')).toEqual({ min: { x: 0, y: 37 }, max: { x: 230, y: 172 } });
	});
});
