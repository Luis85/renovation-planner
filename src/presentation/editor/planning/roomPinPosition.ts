import type { CurvedPolygon } from '../../../core/geometry/CurvedPolygon';
import type { Point } from '../../../core/geometry/Point';
import { boundingBoxOf } from '../../../core/geometry/operations';

/** Existing normalized world-AABB contract; analytic arc extrema extend its reachable region. */
export function roomPinPosition(room: CurvedPolygon, pin: { readonly x: number; readonly y: number }): Point | null {
	const bounds = boundingBoxOf(room);
	if (!bounds.ok) return null;
	const { min, max } = bounds.value;
	return { x: min.x + pin.x * (max.x - min.x), y: min.y + pin.y * (max.y - min.y) };
}
