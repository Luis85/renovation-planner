import type { Point } from './Point';

/** An axis-aligned extent, by its extreme corners. */
export interface BoundingBox {
	readonly min: Point;
	readonly max: Point;
}
