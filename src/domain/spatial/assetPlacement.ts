import type { BoundingBox } from '../../core/geometry/BoundingBox';
import type { Point } from '../../core/geometry/Point';
import type { CurvedPolygon } from '../../core/geometry/CurvedPolygon';
import { polygonPolyline } from '../../core/geometry/curvePolyline';
import { boundingBoxOf } from '../../core/geometry/operations';
import { unwrap } from '../../core/result/Result';
import { detailIsClosed, detailPolyline, type AssetDetail, type DetailLine } from '../asset/AssetDetail';
import { dimensionsOf, type AssetShape, type Dimensions } from '../asset/AssetShape';
import type { SpatialElement } from './SpatialElement';

/**
 * A placement stores only `[anchor, facingPoint]`; everything drawn or measured is derived here
 * from the library's `AssetShape`, so a designer correction reaches every plan. Move, rotate and
 * group transforms map both stored points, which preserves position and heading at once.
 */
const MEMBERSHIP_PROBE_MM = 10;
const FACING_POINT_MM = 1000;

/** Within this many millimetres of the library's size on both sides, a placement stores no size of its own. */
const SIZE_MATCH_MM = 0.5;

/**
 * Arcs are flattened BEFORE placement, so every plan consumer keeps reading `Point[]` (symbols spec,
 * Rendering). 1 mm of sagitta is below a pixel at any zoom a plan is drawn at.
 *
 * Flattening first also makes a placement's own `size` a TRUE stretch, where the designer's
 * `scaleDesignToDimensions` keeps each bulge and leaves every arc circular through its new chord. The
 * same nominal size therefore measures the same on both surfaces and draws a slightly different
 * silhouette — deliberately, and pinned by `tests/domain/asset/stretchParity.test.ts`. The designer
 * cannot do what this does because it has to STORE its curves and a bulge cannot express an ellipse;
 * the trigger for closing the gap is native ellipse or path geometry in `CurvedPolygon`, which would
 * have to arrive for validation, bounds, hit testing, persistence and export at once.
 * ponytail: fixed world tolerance; pass the zoom in if a close-up ever shows facets.
 */
const PLAN_ARC_TOLERANCE_MM = 1;
const flattened = (outline: CurvedPolygon): readonly Point[] => polygonPolyline(outline, PLAN_ARC_TOLERANCE_MM);

export interface PlacedDetail {
	readonly points: readonly Point[];
	readonly line: DetailLine;
	/**
	 * Whether the graphic closes (AD05). A plan renderer needs it because `points` alone cannot say:
	 * an open path and a closed ring are both a run of coordinates, and drawing the open one closed
	 * adds an edge the object has not got and fills an interior it does not have.
	 */
	readonly closed: boolean;
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

/** How far a placement's own size stretches its library shape along the shape's x and y; 1 × 1 without one, or when the library has no representable extent. */
function placementScale(element: Pick<SpatialElement, 'size'>, shape: AssetShape): { readonly x: number; readonly y: number } {
	const library = dimensionsOf(shape.footprint);
	return element.size && library.ok ? { x: element.size.width / library.value.width, y: element.size.depth / library.value.depth } : { x: 1, y: 1 };
}

function place(points: readonly Point[], shape: AssetShape, heading: number, at: Point, scale: { readonly x: number; readonly y: number }): Point[] {
	const turn = heading - shape.facing, cos = Math.cos(turn), sin = Math.sin(turn);
	return points.map(point => {
		const dx = (point.x - shape.anchor.x) * scale.x, dy = (point.y - shape.anchor.y) * scale.y;
		return { x: at.x + dx * cos - dy * sin, y: at.y + dx * sin + dy * cos };
	});
}

/** The asset's footprint, clearance and details in world millimetres, arcs flattened: stretched by the placement's own size, turned by heading − facing about the asset anchor, moved onto the placement anchor. */
export function placedOutline(element: Pick<SpatialElement, 'points' | 'size'>, shape: AssetShape): PlacedOutline {
	const heading = placementHeading(element), anchor = element.points[0], scale = placementScale(element, shape);
	const onPlan = (outline: CurvedPolygon): Point[] => place(flattened(outline), shape, heading, anchor, scale);
	// A graphic is flattened by its OWN kind, and then placed by the same transform as everything
	// else. This used to add "which `polygonPolyline` drops", which is false for a path and
	// contradicted `assetPlacement.test.ts` two files away — that test already states the true
	// mechanism: the closing edge contributes only its start, which IS the run's last point, so
	// the two agree by construction. `detailPolyline` is the right call for the BRAND, not the points.
	const graphicOnPlan = (detail: AssetDetail): Point[] => place(detailPolyline(detail, PLAN_ARC_TOLERANCE_MM), shape, heading, anchor, scale);
	return {
		footprint: onPlan(shape.footprint),
		clearance: shape.clearance ? onPlan(shape.clearance) : null,
		details: shape.details.map(detail => ({ points: graphicOnPlan(detail), line: detail.line, closed: detailIsClosed(detail) })),
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

/**
 * The footprint's curve-aware box in the PLACEMENT FRAME — the anchor at the origin, x along the
 * library shape's x (turned onto the plan by heading − facing) — stretched by the placement's own size.
 * `unwrap`: every shape reaching a plan has been through `validateAssetShape`, whose footprint always has a box.
 */
export function placementBox(element: Pick<SpatialElement, 'size'>, shape: AssetShape): BoundingBox {
	const box = unwrap(boundingBoxOf(shape.footprint)), scale = placementScale(element, shape), { anchor } = shape;
	return {
		min: { x: (box.min.x - anchor.x) * scale.x, y: (box.min.y - anchor.y) * scale.y },
		max: { x: (box.max.x - anchor.x) * scale.x, y: (box.max.y - anchor.y) * scale.y },
	};
}

/**
 * The placement a box resize leaves (plan editor transform box design, Geometry): `factors` stretch the
 * placement frame about `fixed`, a point in that frame which stays put on the plan. The anchor moves by
 * `fixed ⊙ (1 − factors)` turned onto the plan, the heading is kept, and a size back within half a
 * millimetre of the library's is stored as none. `null` when the library has no representable extent.
 */
export function resizedPlacement(
	element: Pick<SpatialElement, 'points' | 'size'>,
	shape: AssetShape,
	factors: { readonly sx: number; readonly sy: number },
	fixed: Point,
): { readonly points: readonly [Point, Point]; readonly size: Dimensions | undefined } | null {
	const library = dimensionsOf(shape.footprint);
	if (!library.ok) return null;
	const scale = placementScale(element, shape), heading = placementHeading(element), anchor = element.points[0];
	const size = { width: library.value.width * scale.x * factors.sx, depth: library.value.depth * scale.y * factors.sy };
	const local = { x: fixed.x * (1 - factors.sx), y: fixed.y * (1 - factors.sy) };
	const turn = heading - shape.facing, cos = Math.cos(turn), sin = Math.sin(turn);
	const moved = { x: anchor.x + local.x * cos - local.y * sin, y: anchor.y + local.x * sin + local.y * cos };
	const matches = Math.abs(size.width - library.value.width) <= SIZE_MATCH_MM && Math.abs(size.depth - library.value.depth) <= SIZE_MATCH_MM;
	return { points: placementPoints(moved, heading), size: matches ? undefined : size };
}

/** The element with `size` set, or with the key physically removed when there is none — the way a reset color removes `color`. */
export function withPlacementSize<T extends SpatialElement>(element: T, size: Dimensions | undefined): T {
	const { size: previous, ...plain } = element;
	void previous;
	return (size === undefined ? plain : { ...plain, size }) as T;
}
