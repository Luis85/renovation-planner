import type { Point } from '../../core/geometry/Point';
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../core/geometry/curvePolyline';
import type { DetailLine } from '../asset/AssetDetail';
import type { AssetShape } from '../asset/AssetShape';
import type { SpatialElement } from './SpatialElement';

/**
 * A placement stores only `[anchor, facingPoint]`; everything drawn or measured is derived here
 * from the library's `AssetShape`, so a designer correction reaches every plan. Move, rotate and
 * group transforms map both stored points, which preserves position and heading at once.
 */
const MEMBERSHIP_PROBE_MM = 10;
const FACING_POINT_MM = 1000;

/**
 * Arcs are flattened BEFORE placement, so every plan consumer keeps reading `Point[]` (symbols spec,
 * Rendering). 1 mm of sagitta is below a pixel at any zoom a plan is drawn at.
 * ponytail: fixed world tolerance; pass the zoom in if a close-up ever shows facets.
 */
const PLAN_ARC_TOLERANCE_MM = 1;
const flattened = (outline: CurvedPolygon): readonly Point[] => polygonPolyline(outline, PLAN_ARC_TOLERANCE_MM);

export interface PlacedDetail {
	readonly points: readonly Point[];
	readonly line: DetailLine;
}

export interface PlacedOutline {
	readonly footprint: readonly Point[];
	readonly clearance: readonly Point[] | null;
	readonly details: readonly PlacedDetail[];
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

/** The asset's footprint, clearance and details in world millimetres, arcs flattened: turned by heading − facing about the asset anchor, moved onto the placement anchor. */
export function placedOutline(element: Pick<SpatialElement, 'points'>, shape: AssetShape): PlacedOutline {
	const heading = placementHeading(element), anchor = element.points[0];
	const onPlan = (outline: CurvedPolygon): Point[] => place(flattened(outline), shape, heading, anchor);
	return {
		footprint: onPlan(shape.footprint),
		clearance: shape.clearance ? onPlan(shape.clearance) : null,
		details: shape.details.map(detail => ({ points: onPlan(detail.outline), line: detail.line })),
	};
}

/** The point that decides which room a placement belongs to: 10 mm in front of the anchor, so a wall-snapped anchor counts in the room it faces. */
export function membershipProbe(element: Pick<SpatialElement, 'points'>): Point {
	const heading = placementHeading(element), anchor = element.points[0];
	return { x: anchor.x + MEMBERSHIP_PROBE_MM * Math.cos(heading), y: anchor.y + MEMBERSHIP_PROBE_MM * Math.sin(heading) };
}

/** How far the footprint reaches behind the anchor along the asset's own facing; 0 when nothing is behind it. */
export function backDepth(shape: AssetShape): number {
	const cos = Math.cos(shape.facing), sin = Math.sin(shape.facing);
	const along = flattened(shape.footprint).map(point => (point.x - shape.anchor.x) * cos + (point.y - shape.anchor.y) * sin);
	return Math.max(0, -Math.min(...along));
}
