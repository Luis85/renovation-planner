import type { Point } from './Point';
import type { CurvedPolygon } from './CurvedPolygon';
import { arcRayCrossings, curveTolerance } from './circularIntersections';

/** Analytic ray crossings; curve containment never depends on rendering tessellation. */
export function curvedContains(shape: CurvedPolygon, point: Point): boolean {
	let scale = 1;
	for (const vertex of shape.points) scale = Math.max(scale, Math.abs(vertex.x - point.x), Math.abs(vertex.y - point.y));
	const points = shape.points.map(vertex => ({ x: (vertex.x - point.x) / scale, y: (vertex.y - point.y) / scale }));
	const epsilon = curveTolerance([...shape.points, point]) / scale;
	let crossings = 0;
	for (let index = 0; index < points.length; index++) {
		const start = points[index], end = points[(index + 1) % points.length], bulge = shape.bulges?.[index] ?? 0;
		if (bulge !== 0) crossings += arcRayCrossings({ start, end, bulge }, epsilon);
		else if (start.y > 0 !== end.y > 0 && 0 < (end.x - start.x) * -start.y / (end.y - start.y) + start.x) crossings++;
	}
	return crossings % 2 !== 0;
}
