import type { Point } from '../../core/geometry/Point';

/** A dimension chain laid out on its line (plan drafting tools design §3). */
export interface DimensionChain {
	/** Unit vector from the first point toward the last. */
	readonly direction: Point;
	/** Unit normal; a positive offset points this way. */
	readonly normal: Point;
	/** Each point's foot on the dimension line, in point order. */
	readonly feet: readonly Point[];
	/** The projected length between consecutive points, world mm; 0 where two project onto each other. */
	readonly lengths: readonly number[];
}

function frame(points: readonly Point[]): { origin: Point; direction: Point; normal: Point } | null {
	const origin = points[0], last = points.at(-1);
	if (!origin || !last || points.length < 2) return null;
	const length = Math.hypot(last.x - origin.x, last.y - origin.y);
	if (!(length > 0)) return null;
	const direction = { x: (last.x - origin.x) / length, y: (last.y - origin.y) / length };
	return { origin, direction, normal: { x: -direction.y, y: direction.x } };
}

/** The only source of a chain's lengths: every point projected onto the first-to-last line; nothing stores one. */
export function dimensionChain(points: readonly Point[], offset: number): DimensionChain | null {
	const axis = frame(points);
	if (!axis) return null;
	const { origin, direction, normal } = axis;
	const along = points.map(point => (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y);
	const feet = along.map(value => ({ x: origin.x + direction.x * value + normal.x * offset, y: origin.y + direction.y * value + normal.y * offset }));
	return { direction, normal, feet, lengths: along.slice(1).map((value, index) => Math.abs(value - along[index])) };
}

/** A point's signed distance from the chain's first-to-last line: the offset a line placed there would have. */
export function dimensionOffsetAt(points: readonly Point[], point: Point): number {
	const axis = frame(points);
	return axis ? (point.x - axis.origin.x) * axis.normal.x + (point.y - axis.origin.y) * axis.normal.y : 0;
}
