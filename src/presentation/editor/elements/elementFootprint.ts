import type { Point } from '../../../core/geometry/Point';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { placedOutline } from '../../../domain/spatial/assetPlacement';
import { spatialElementFootprint } from '../../../domain/spatial/stairGeometry';

export type ShapeLookup = (assetId: string) => AssetShape | null;
export const NO_SHAPES: ShapeLookup = () => null;
/** Half the side of the square a placement without a readable shape is drawn and hit as. */
const PLACEHOLDER_HALF_MM = 250;

/** What the canvas hits and outlines: an asset's derived footprint, or its placeholder square; every other kind as the domain derives it. */
export function elementFootprint(element: SpatialElement, shapeOf: ShapeLookup): readonly Point[] {
	if (element.kind !== 'asset') return spatialElementFootprint(element);
	const shape = element.assetId ? shapeOf(element.assetId) : null;
	if (shape) return placedOutline(element, shape).footprint;
	const { x, y } = element.points[0], half = PLACEHOLDER_HALF_MM;
	return [{ x: x - half, y: y - half }, { x: x + half, y: y - half }, { x: x + half, y: y + half }, { x: x - half, y: y + half }];
}
