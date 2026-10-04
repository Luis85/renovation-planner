import { createPolygon, type Polygon } from '../../../core/geometry/Polygon';
import { area, isNegligibleArea } from '../../../core/geometry/operations';
import type { Point } from '../../../core/geometry/Point';
import type { GeometryError } from '../../../core/errors/AppError';
import { err, type Result } from '../../../core/result/Result';

/**
 * Area creation requires a measurable surface; legacy Zone files remain readable unchanged.
 * 'Measurable' is the Zone entity's own rule (owner ruling 36, `isNegligibleArea`), so a typed
 * outline this accepts is one the write will not refuse as zero area. Through `simpleAreaOutline`
 * the same rule reaches the object, post and hatch outlines `elementDraft` gates.
 */
export function areaOutline(points: readonly Point[]): Result<Polygon, GeometryError> {
	const polygon = createPolygon(points);
	if (!polygon.ok) return polygon;
	const measured = area(polygon.value);
	if (!measured.ok) return measured;
	if (isNegligibleArea(polygon.value, measured.value)) return err({ category: 'Geometry', code: 'polygon-zero-area', message: 'An area must enclose a surface.' });
	return polygon;
}
