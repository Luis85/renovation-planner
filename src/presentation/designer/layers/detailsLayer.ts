import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { ARC_TOLERANCE_PX, flatPoints, footprintOutline, type OutlineConfig } from './footprintLayer';

/**
 * An asset's symbol details (asset designer symbols spec, Decisions 1 and 4), one config per detail
 * in array order. A SOLID detail is filled with the canvas colour so it covers what is beneath it;
 * a DASHED one is unfilled, because dashed means overhead or hidden. Thinner than the footprint,
 * which stays the heavier mark of record.
 */
export interface DetailOutlineConfig extends OutlineConfig {
	/** The detail's own id — what the canvas keys its node by, so a reorder moves nodes rather than repainting them. */
	readonly id: string;
	readonly fill?: string;
}

const DETAIL_STROKE_PX = 1;
/** Also the dash `selectionLayer.ts` restrokes a selected dashed detail in, so it stays dashed while edited. */
export const DETAIL_DASH_PX: readonly number[] = [4, 3];

export function detailOutlines(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): DetailOutlineConfig[] {
	if (shape === null) return [];
	return shape.details.map((detail) => ({
		id: detail.id,
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

/**
 * The footprint's stroke again, unfilled, drawn LAST in the details layer: a solid detail is filled
 * with the canvas colour, so one lying against the footprint covers the inner half of its stroke and
 * the outline of record reads thinner exactly where a detail meets it. `null` with no details, when
 * nothing can cover it and a second stroke would be ink for nothing.
 */
export function footprintEdge(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): OutlineConfig | null {
	if (shape === null || shape.details.length === 0) return null;
	return footprintOutline(shape, tokens, worldPerPixel);
}
