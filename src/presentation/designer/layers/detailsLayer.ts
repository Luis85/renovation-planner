import { detailIsClosed, detailPolyline } from '../../../domain/asset/AssetDetail';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { ARC_TOLERANCE_PX, flatPoints, footprintOutline, type OutlineConfig } from './footprintLayer';

/**
 * An asset's symbol details (asset designer symbols spec, Decisions 1 and 4), one config per detail
 * in array order. A SOLID detail is filled with the canvas colour so it covers what is beneath it;
 * a DASHED one is unfilled, because dashed means overhead or hidden. Thinner than the footprint,
 * which stays the heavier mark of record.
 */
export interface DetailOutlineConfig extends Omit<OutlineConfig, 'closed'> {
	/** The detail's own id — what the canvas keys its node by, so a reorder moves nodes rather than repainting them. */
	readonly id: string;
	/**
	 * `false` for an OPEN graphic (AD04/AD05), which is why this widens `OutlineConfig`'s literal
	 * `true` rather than inheriting it: a footprint or a clearance always closes, and a detail is
	 * now the one outline on this surface that may not.
	 */
	readonly closed: boolean;
	readonly fill?: string;
}

const DETAIL_STROKE_PX = 1;
/** Also the dash `selectionLayer.ts` restrokes a selected dashed detail in, so it stays dashed while edited. */
export const DETAIL_DASH_PX: readonly number[] = [4, 3];

/**
 * `hidden` is the Parts panel's leaf-local visibility (AD09) and is an EDITING AID rather than
 * output (C10): it drops a graphic from THIS frame's configs and reaches nothing else, so the
 * stored shape — and with it plan placement, the library mark and every quantity derived from the
 * asset — is exactly what it was. Nothing persists it and a reopened leaf draws everything again.
 */
export function detailOutlines(
	shape: AssetShape | null,
	tokens: ThemeTokens,
	worldPerPixel: number,
	hidden: ReadonlySet<string> = new Set(),
): DetailOutlineConfig[] {
	if (shape === null) return [];
	return shape.details.filter((detail) => !hidden.has(detail.id)).map((detail) => {
		const closed = detailIsClosed(detail);
		return {
			id: detail.id,
			points: flatPoints(detailPolyline(detail, ARC_TOLERANCE_PX * worldPerPixel)),
			closed,
			stroke: tokens.zoneStroke,
			strokeWidth: DETAIL_STROKE_PX,
			strokeScaleEnabled: false,
			listening: false,
			perfectDrawEnabled: false,
			// **An OPEN graphic is never filled, whatever its line says** (C10): a fill needs an
			// interior and a path has none, so a `solid` open one would be handed a fill colour and a
			// closing edge Konva draws for it — the wrong picture rather than a missing one. Solid on
			// an open graphic means an unbroken stroke; dashed still means dashed.
			...(detail.line === 'solid' ? (closed ? { fill: tokens.canvasBackground } : {}) : { dash: [...DETAIL_DASH_PX] }),
		};
	});
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
