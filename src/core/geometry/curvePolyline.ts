import type { Point } from './Point';
import type { CurvedPolygon } from './CurvedPolygon';
import { arcPoint, arcRadius, type CircularEdge } from './circularArc';

/** Display approximation only. Measurements, selection and persistence use analytic arcs. */
export function arcPolyline(edge: CircularEdge, tolerance = 1): readonly Point[] {
	const radius = arcRadius(edge);
	if (radius === null) return [edge.start, edge.end];
	const angle = Math.abs(4 * Math.atan(edge.bulge));
	const step = 2 * Math.acos(Math.max(-1, 1 - Math.max(1e-9, tolerance) / radius));
	const count = Math.min(4096, Math.max(2, Math.ceil(angle / Math.max(step, 1e-6))));
	return Array.from({ length: count + 1 }, (_, index) => arcPoint(edge, index / count));
}

export function polygonPolyline(polygon: CurvedPolygon, tolerance = 1): readonly Point[] {
	if (!polygon.bulges?.some(value => value !== 0)) return polygon.points;
	return polygon.points.flatMap((start, index) => arcPolyline({ start, end: polygon.points[(index + 1) % polygon.points.length], bulge: polygon.bulges?.[index] ?? 0 }, tolerance).slice(0, -1));
}
