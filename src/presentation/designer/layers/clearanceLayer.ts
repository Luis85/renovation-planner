import { polygonPolyline } from '../../../core/geometry/curvePolyline';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { ThemeTokens } from '../../editor/theme/themeTokens';
import { ARC_TOLERANCE_PX, flatPoints, type OutlineConfig } from './footprintLayer';

/**
 * The space an asset needs AROUND itself — an oven's door swing, a chair's pull-out — drawn
 * over the footprint it belongs to (design slice B4).
 *
 * **Dashed, against the footprint's solid**, which reuses `footprintLayer.ts`'s own
 * provisional-against-committed vocabulary rather than inventing a second one: the clearance
 * is a region a plan must keep free, not a thing that occupies it. Zones no longer carry a
 * dashed/solid distinction of their own to borrow — status stopped drawing on the plan
 * editor's canvas on 2026-09-10 (canvas fidelity spec) — so this pairing now lives here
 * first rather than being learnt from `ZoneRenderModel.statusAppearance` beforehand.
 *
 * The dash lengths are SCREEN pixels, not world millimetres, because the stroke they belong to
 * sets `strokeScaleEnabled: false`. A dash measured in millimetres would collapse into a solid
 * line at any zoom that made the shape small enough to see whole, which is exactly when the
 * distinction is needed.
 */
export const CLEARANCE_DASH_PX: readonly number[] = [8, 6];

/**
 * The footprint's own weight: the DASH, not the stroke, tells the two apart. It was 1 px, and a 1 px
 * accent dash measured about 2.98:1 against the light theme's white canvas, under WCAG 1.4.11's 3:1 for
 * a non-text mark; a thicker line renders closer to the token's own colour (selection polish critique,
 * finding 19). `selectionLayer.ts` restrokes a selected clearance in the dash above.
 */
const CLEARANCE_STROKE_PX = 1.5;

/**
 * `null` twice over, and the two absences are different facts a caller does not have to tell
 * apart: an asset with no shape at all, and a shape that carries no clearance. Both are
 * ordinary — `AssetShape.clearance` is nullable and `validateAssetShape` refuses only the
 * incoherent pairing of an absent clearance with a pending flag on it.
 */
export function clearanceOutline(shape: AssetShape | null, tokens: ThemeTokens, worldPerPixel: number): OutlineConfig | null {
	if (shape === null || shape.clearance === null) return null;
	return {
		points: flatPoints(polygonPolyline(shape.clearance, ARC_TOLERANCE_PX * worldPerPixel)),
		closed: true,
		stroke: tokens.accent,
		strokeWidth: CLEARANCE_STROKE_PX,
		strokeScaleEnabled: false,
		listening: false,
		perfectDrawEnabled: false,
		dash: [...CLEARANCE_DASH_PX],
	};
}
