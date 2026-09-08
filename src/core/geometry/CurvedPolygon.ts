import type { Polygon } from './Polygon';
import { createPolygon } from './Polygon';
import type { GeometryError } from '../errors/AppError';
import { err, ok, type Result } from '../result/Result';
import { arcRadius } from './circularArc';
import { circularEdgeIntersections, curveTolerance } from './circularIntersections';

/** Closed boundary: bulge i describes edge i→i+1, with implicit last→first closure. */
export interface CurvedPolygon extends Polygon { readonly bulges?: readonly number[] }
export const hasCurves = (shape: CurvedPolygon): boolean => shape.bulges?.some(value => value !== 0) ?? false;
export function validateBulges(shape: CurvedPolygon): Result<void, GeometryError> {
	const bulges = shape.bulges;
	if (bulges === undefined) return ok(undefined);
	if (bulges.length !== shape.points.length) return err({ category: 'Geometry', code: 'curve-edge-count', message: 'Every boundary edge needs one curve value.' });
	for (let index = 0; index < bulges.length; index++) {
		const bulge = bulges[index];
		if (!Number.isFinite(bulge) || Math.abs(bulge) > 1) return err({ category: 'Geometry', code: 'curve-bulge-invalid', message: 'A curved edge supports at most a semicircle; split a larger arc into separate edges.' });
		if (bulge === 0) continue;
		const radius = arcRadius({ start: shape.points[index], end: shape.points[(index + 1) % shape.points.length], bulge });
		if (radius === null || !Number.isFinite(radius) || radius <= 0) return err({ category: 'Geometry', code: 'curve-chord-invalid', message: 'A curved edge needs distinct endpoints and a representable radius.' });
	}
	return ok(undefined);
}
export function createCurvedPolygon(shape: CurvedPolygon): Result<CurvedPolygon, GeometryError> {
	const polygon = createPolygon(shape.points); if (!polygon.ok) return polygon;
	const curves = validateBulges(shape); if (!curves.ok) return curves;
	const simple = validateCurvedBoundary(shape); if (!simple.ok) return simple;
	return ok({ ...polygon.value, ...(shape.bulges !== undefined && hasCurves(shape) ? { bulges: [...shape.bulges] } : {}) });
}
/** Curved contours must be simple; legacy straight polygon validation is unchanged. */
export function validateCurvedBoundary(shape: CurvedPolygon): Result<void, GeometryError> {
	if (!hasCurves(shape)) return ok(undefined);
	const edges = shape.points.map((start, index) => ({ start, end: shape.points[(index + 1) % shape.points.length], bulge: shape.bulges?.[index] ?? 0 }));
	const epsilon = curveTolerance(shape.points);
	for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
		const result = circularEdgeIntersections(edges[i], edges[j]);
		const shared = j === i + 1 ? edges[i].end : i === 0 && j === edges.length - 1 ? edges[i].start : null;
		if (result.overlap || result.points.some(point => shared === null || Math.hypot(point.x - shared.x, point.y - shared.y) > epsilon)) return err({ category: 'Geometry', code: 'curve-self-intersection', message: 'Curved boundary edges may meet only at neighbouring corners.' });
	}
	return ok(undefined);
}
/** Legacy point transforms keep edge parameters; a topology change requires an explicit curve map. */
export function preservePointCurves(original: CurvedPolygon, next: CurvedPolygon): Result<CurvedPolygon, GeometryError> {
	if (next.bulges !== undefined || !hasCurves(original)) return ok(next);
	if (next.points.length !== original.points.length) return err({ category: 'Geometry', code: 'curve-topology-ambiguous', message: 'Straighten the curved edges before adding or removing corners.' });
	return ok({ ...next, bulges: original.bulges });
}
