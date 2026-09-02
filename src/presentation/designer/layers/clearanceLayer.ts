import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { flatPoints, type OutlineConfig } from './footprintLayer';

/**
 * The space an asset needs AROUND itself — an oven's door swing, a chair's pull-out — drawn
 * over the footprint it belongs to (design slice B4).
 *
 * **Dashed, against the footprint's solid**, which is the plan editor's existing vocabulary for
 * provisional against committed rather than a new one: the clearance is a region a plan must
 * keep free, not a thing that occupies it, and a user reading the canvas has already learnt
 * that distinction from `ZoneRenderModel.statusAppearance`.
 *
 * The dash lengths are SCREEN pixels, not world millimetres, because the stroke they belong to
 * sets `strokeScaleEnabled: false` — the same pairing `ZoneRenderModel` documents. A dash
 * measured in millimetres would collapse into a solid line at any zoom that made the shape
 * small enough to see whole, which is exactly when the distinction is needed.
 */
const CLEARANCE_DASH_PX = [8, 6];

/** Thinner than the footprint: the outline of record is the heavier of the two marks. */
const CLEARANCE_STROKE_PX = 1;

/**
 * `null` twice over, and the two absences are different facts a caller does not have to tell
 * apart: an asset with no shape at all, and a shape that carries no clearance. Both are
 * ordinary — `AssetShape.clearance` is nullable and `validateAssetShape` refuses only the
 * incoherent pairing of an absent clearance with a pending flag on it.
 */
export function clearanceOutline(shape: AssetShape | null, tokens: ThemeTokens): OutlineConfig | null {
	if (shape === null || shape.clearance === null) return null;
	return {
		points: flatPoints(shape.clearance.points),
		closed: true,
		stroke: tokens.accent,
		strokeWidth: CLEARANCE_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
		dash: [...CLEARANCE_DASH_PX],
	};
}
