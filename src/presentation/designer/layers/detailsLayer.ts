import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { ARC_TOLERANCE_PX, flatPoints, type OutlineConfig } from './footprintLayer';

/**
 * An asset's symbol details (asset designer symbols spec, Decisions 1 and 4), one config per detail
 * in array order. A SOLID detail is filled with the canvas colour so it covers what is beneath it;
 * a DASHED one is unfilled, because dashed means overhead or hidden. Thinner than the footprint,
 * which stays the heavier mark of record.
 */
export interface DetailOutlineConfig extends OutlineConfig {
	readonly fill?: string;
}

const DETAIL_STROKE_PX = 1;
const DETAIL_DASH_PX = [4, 3];

export function detailOutlines(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): DetailOutlineConfig[] {
	if (shape === null) return [];
	return shape.details.map((detail) => ({
		points: flatPoints(polygonPolyline(detail.outline, ARC_TOLERANCE_PX * worldPerPixel)),
		closed: true,
		stroke: tokens.zoneStroke,
		strokeWidth: DETAIL_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
		...(detail.line === 'solid' ? { fill: tokens.canvasBackground } : { dash: [...DETAIL_DASH_PX] }),
	}));
}
