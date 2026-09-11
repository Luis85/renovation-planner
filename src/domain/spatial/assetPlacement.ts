import type { Point } from '../../core/geometry/Point';
import type { AssetShape } from '../asset/AssetShape';
import type { SpatialElement } from './SpatialElement';

/**
 * A placement stores only `[anchor, facingPoint]`; everything drawn or measured is derived here
 * from the library's `AssetShape`, so a designer correction reaches every plan. Move, rotate and
 * group transforms map both stored points, which preserves position and heading at once.
 */
const MEMBERSHIP_PROBE_MM = 10;
const FACING_POINT_MM = 1000;

export interface PlacedOutline {
	readonly footprint: readonly Point[];
	readonly clearance: readonly Point[] | null;
}

export function placementHeading(element: Pick<SpatialElement, 'points'>): number {
	const [anchor, facing] = element.points;
	return Math.atan2(facing.y - anchor.y, facing.x - anchor.x);
}

export function placementPoints(anchor: Point, heading: number): readonly [Point, Point] {
	return [{ x: anchor.x, y: anchor.y }, { x: anchor.x + FACING_POINT_MM * Math.cos(heading), y: anchor.y + FACING_POINT_MM * Math.sin(heading) }];
}

function place(points: readonly Point[], shape: AssetShape, heading: number, at: Point): Point[] {
	const turn = heading - shape.facing, cos = Math.cos(turn), sin = Math.sin(turn);
	return points.map(point => {
		const dx = point.x - shape.anchor.x, dy = point.y - shape.anchor.y;
		return { x: at.x + dx * cos - dy * sin, y: at.y + dx * sin + dy * cos };
	});
}

/** The asset's footprint and clearance in world millimetres: turned by heading − facing about the asset anchor, moved onto the placement anchor. */
export function placedOutline(element: Pick<SpatialElement, 'points'>, shape: AssetShape): PlacedOutline {
	const heading = placementHeading(element), anchor = element.points[0];
	return { footprint: place(shape.footprint.points, shape, heading, anchor), clearance: shape.clearance ? place(shape.clearance.points, shape, heading, anchor) : null };
}

/** The point that decides which room a placement belongs to: 10 mm in front of the anchor, so a wall-snapped anchor counts in the room it faces. */
export function membershipProbe(element: Pick<SpatialElement, 'points'>): Point {
	const heading = placementHeading(element), anchor = element.points[0];
	return { x: anchor.x + MEMBERSHIP_PROBE_MM * Math.cos(heading), y: anchor.y + MEMBERSHIP_PROBE_MM * Math.sin(heading) };
}

/** How far the footprint reaches behind the anchor along the asset's own facing; 0 when nothing is behind it. */
export function backDepth(shape: AssetShape): number {
	const cos = Math.cos(shape.facing), sin = Math.sin(shape.facing);
	const along = shape.footprint.points.map(point => (point.x - shape.anchor.x) * cos + (point.y - shape.anchor.y) * sin);
	return Math.max(0, -Math.min(...along));
}
