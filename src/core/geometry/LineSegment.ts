import type { Point } from './Point';

/** A bounded segment — not an infinite line. */
export interface LineSegment {
	readonly start: Point;
	readonly end: Point;
}
