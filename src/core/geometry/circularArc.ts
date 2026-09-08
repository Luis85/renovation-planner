import type { Point } from './Point';

/** A signed circular arc, following the existing x/y rotation convention. Zero is a line. */
export interface CircularEdge { readonly start: Point; readonly end: Point; readonly bulge: number }
export function arcLength(edge: CircularEdge): number {
	const chord = Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y), b = Math.abs(edge.bulge);
	return b === 0 ? chord : chord * (1 + b * b) * (Math.atan(b) / b);
}
export function arcRadius(edge: CircularEdge): number | null {
	const b = Math.abs(edge.bulge);
	return b === 0 ? null : Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y) * (1 + b * b) / (4 * b);
}
/** Avoid subtracting a huge circle radius from its centre for a shallow arc. */
export function arcPoint(edge: CircularEdge, fraction: number): Point {
	if (fraction === 0) return { ...edge.start };
	if (fraction === 1) return { ...edge.end };
	const dx = edge.end.x - edge.start.x, dy = edge.end.y - edge.start.y, b = edge.bulge;
	if (b === 0) return { x: edge.start.x + dx * fraction, y: edge.start.y + dy * fraction };
	const angle = fraction * 4 * Math.atan(b), complement = 2 * Math.sin(angle / 2) ** 2;
	const x = complement / 2 + (1 - b * b) / 4 * (Math.sin(angle) / b);
	const y = (1 - b * b) / 4 * (complement / b) - Math.sin(angle) / 2;
	return { x: edge.start.x + dx * x - dy * y, y: edge.start.y + dy * x + dx * y };
}
export function arcTangent(edge: CircularEdge, fraction: number): Point {
	const dx = edge.end.x - edge.start.x, dy = edge.end.y - edge.start.y, length = Math.hypot(dx, dy);
	if (length === 0) return { x: 0, y: 0 };
	const angle = (fraction - 0.5) * 4 * Math.atan(edge.bulge), cos = Math.cos(angle), sin = Math.sin(angle);
	return { x: (dx * cos - dy * sin) / length, y: (dy * cos + dx * sin) / length };
}
/** Nearest point on the bounded arc; local angle algebra also works for very shallow curves. */
export function arcProjection(edge: CircularEdge, point: Point): { point: Point; fraction: number; distance: number } {
	const dx = edge.end.x - edge.start.x, dy = edge.end.y - edge.start.y, chord = Math.hypot(dx, dy), b = edge.bulge;
	const candidates = [{ point: edge.start, fraction: 0 }, { point: edge.end, fraction: 1 }];
	if (chord !== 0) {
		const px = (point.x - edge.start.x) / chord, py = (point.y - edge.start.y) / chord;
		const x = px * (dx / chord) + py * (dy / chord), y = py * (dx / chord) - px * (dy / chord);
		let fraction = Math.max(0, Math.min(1, x));
		if (b !== 0) {
			const h = (1 - b * b) / (4 * b), inverse = 4 * b / (1 - b * b);
			const cross = Math.abs(b) < 0.5 ? x * inverse - y * inverse * inverse / 2 : h * x - y / 2;
			const dot = Math.abs(b) < 0.5 ? 1 - y * inverse + (0.25 - x / 2) * inverse * inverse : h * h - h * y - x / 2 + 0.25;
			fraction = Math.atan2(cross, dot) / (4 * Math.atan(b));
		}
		if (fraction >= 0 && fraction <= 1) candidates.push({ point: arcPoint(edge, fraction), fraction });
	}
	let closest = { ...candidates[0], distance: Math.hypot(point.x - edge.start.x, point.y - edge.start.y) };
	for (const candidate of candidates.slice(1)) {
		const distance = Math.hypot(point.x - candidate.point.x, point.y - candidate.point.y);
		if (distance < closest.distance) closest = { ...candidate, distance };
	}
	return closest;
}
/** Endpoints and the actual cardinal extrema, without a sampled approximation. */
export function arcExtrema(edge: CircularEdge): readonly Point[] {
	const points = [{ ...edge.start }, { ...edge.end }], sweep = 4 * Math.atan(edge.bulge);
	if (sweep === 0) return points;
	const heading = Math.atan2(edge.end.y - edge.start.y, edge.end.x - edge.start.x);
	for (const tangent of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
		const difference = Math.atan2(Math.sin(tangent - heading), Math.cos(tangent - heading));
		const fraction = 0.5 + difference / sweep;
		if (fraction > 0 && fraction < 1) points.push(arcPoint(edge, fraction));
	}
	return points;
}
/** Signed area and normal first moment of the circular segment relative to its chord midpoint. */
export function arcSegmentMoments(edge: CircularEdge): { area: number; normalMoment: number; normalCentroid: number } {
	const b = edge.bulge, square = b * b, chord = Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y);
	if (b === 0) return { area: 0, normalMoment: 0, normalCentroid: 0 };
	const small = Math.abs(b) < 0.01;
	const areaSeries = 1 / 3 + square * (1 / 15 + square * (-1 / 105 + square * (1 / 315 + square * (-1 / 693 + square / 1287))));
	const coefficient = small ? b * areaSeries
		: ((1 + square) ** 2 * Math.atan(b) / square - (1 - square) / b) / 8;
	const normalSeries = -1 / 15 + square * (-2 / 105 + square * (1 / 315 + square * (-4 / 3465 + square * 5 / 9009)));
	const normalCentroid = chord * (small ? b * normalSeries / areaSeries : (1 - square) / (4 * b) - 1 / (12 * coefficient));
	const area = (chord * coefficient) * chord;
	return { area, normalMoment: area * normalCentroid, normalCentroid };
}
