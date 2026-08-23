import type { Point } from './Point';

/**
 * An OPEN chain of points — not implicitly closed. `Polygon` is the closed shape; the
 * edge back to the first point exists only there.
 */
export interface Polyline {
	readonly points: readonly Point[];
}
