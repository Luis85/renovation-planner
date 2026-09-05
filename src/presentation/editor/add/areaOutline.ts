import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import { area } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { GeometryError } from '../../../core/errors/AppError';
import { err, type Result } from '../../../core/result/Result';

/** Area creation requires a measurable surface; legacy Zone files remain readable unchanged. */
export function areaOutline(points: readonly Point[]): Result<Polygon, GeometryError> {
	const polygon = createPolygon(points);
	if (!polygon.ok) return polygon;
	const measured = area(polygon.value);
	if (!measured.ok) return measured;
	if (measured.value === 0) return err({ category: 'Geometry', code: 'polygon-zero-area', message: 'An area must enclose a surface.' });
	return polygon;
}
