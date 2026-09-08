import type { Point } from '../../../core/geometry/Point';
import type { SnapService } from './snap-service';

/** Share the existing Zone Shift behavior; ordinary point snapping follows this constraint. */
export function constrainDrawingPoint(anchor: Point | undefined, point: Point, shift: boolean, service: Pick<SnapService, 'snapDirection'>): Point {
	return shift && anchor !== undefined ? service.snapDirection(anchor, point) : point;
}
