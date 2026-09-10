import type { Point } from './Point';
import type { CurvedPolygon } from './CurvedPolygon';
import { arcSegmentMoments } from './circularArc';

/** Corrections to the chord polygon, accumulated about the same local origin as shoelace. */
export function curveMoments(shape: CurvedPolygon, origin: Point = { x: 0, y: 0 }) {
	let area = 0, momentX = 0, momentY = 0;
	if (shape.bulges === undefined) return { area, momentX, momentY };
	for (let index = 0; index < shape.points.length; index++) {
		const bulge = shape.bulges?.[index] ?? 0;
		if (bulge === 0) continue;
		const start = shape.points[index], end = shape.points[(index + 1) % shape.points.length];
		const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
		const segment = arcSegmentMoments({ start, end, bulge });
		area += segment.area;
		momentX += segment.area * (start.x / 2 + end.x / 2 - origin.x) - segment.normalMoment * dy / length;
		momentY += segment.area * (start.y / 2 + end.y / 2 - origin.y) + segment.normalMoment * dx / length;
	}
	return { area, momentX, momentY };
}

/** Uniform normalisation preserves circles; weighted contributions avoid tiny area×moment underflow. */
export function curvedCentroid(shape: CurvedPolygon): Point {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const point of shape.points) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); }
	const origin = { x: minX / 2 + maxX / 2, y: minY / 2 + maxY / 2 };
	let scale = 0;
	for (const point of shape.points) scale = Math.max(scale, Math.abs(point.x - origin.x), Math.abs(point.y - origin.y));
	const points = shape.points.map(point => ({ x: (point.x - origin.x) / scale, y: (point.y - origin.y) / scale }));
	const contributions: { area: number; x: number; y: number }[] = [];
	for (let index = 0; index < points.length; index++) {
		const start = points[index], end = points[(index + 1) % points.length], bulge = shape.bulges?.[index] ?? 0;
		contributions.push({ area: (start.x * end.y - end.x * start.y) / 2, x: (start.x + end.x) / 3, y: (start.y + end.y) / 3 });
		if (bulge === 0) continue;
		const segment = arcSegmentMoments({ start, end, bulge }), length = Math.hypot(end.x - start.x, end.y - start.y);
		contributions.push({ area: segment.area, x: start.x / 2 + end.x / 2 - segment.normalCentroid * (end.y - start.y) / length,
			y: start.y / 2 + end.y / 2 + segment.normalCentroid * (end.x - start.x) / length });
	}
	const total = contributions.reduce((sum, item) => sum + item.area, 0);
	return { x: origin.x + scale * contributions.reduce((sum, item) => sum + item.x * (item.area / total), 0),
		y: origin.y + scale * contributions.reduce((sum, item) => sum + item.y * (item.area / total), 0) };
}
