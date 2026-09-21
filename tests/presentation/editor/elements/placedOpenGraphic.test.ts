/**
 * An OPEN graphic on a PLAN — C10's third consumer, driven at the layer that actually draws it.
 *
 * r1 settles what "every current export path" means here: there is no export subsystem, and the
 * consumers are exactly the authoring canvas, the library mark and plan placement. The first has
 * `detailsLayer`'s cases and `selectionLayer.test.ts`'s; the second reads `shape.footprint` alone
 * (`ListAssetOutlines`), which is a `CurvedPolygon` and can never be a path, so it has nothing to
 * assert; the third is `placedOutline` → `assetShapeConfig`, and `assetPlacement.test.ts` covers
 * only the DOMAIN half of it. This file is the presentation half — the half that decides whether a
 * line is drawn as a line.
 *
 * Its own file rather than cases in `assetShapeConfig.test.ts` because AD11's file lease grants new
 * test files and not edits to that one; the subject is one graphic kind, which reads as a section
 * either way.
 *
 * **`assetShapeConfig.test.ts` has since grown a SOLID open-graphic case of its own** (wave 14,
 * W14-A), written under an AD15 matrix row that read "that file has no open-graphic case" as
 * "the plan renderer's open polyline is unasserted" — a true claim about a file taken for a claim
 * about a behaviour, which this file already covered. It was kept rather than reverted for two
 * assertions measured as non-redundant against the suite: `strokeWidth` on a detail, and the
 * ABSENT `dash` on a solid open one. The dashed arm below is still the only place either `line`
 * value is driven. Both files carry this pointer because a near-duplicate between two `*.test.ts`
 * files is invisible to every gate here, permanently (CLAUDE.md, the `analyze` bullet).
 */
import { describe, expect, it } from 'vitest';
import { expectOk } from '../../../helpers/domain';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { placementPoints } from '../../../../src/domain/spatial/assetPlacement';
import { assetShapeConfig } from '../../../../src/presentation/editor/elements/assetShapeConfig';
import type { ThemeTokens } from '../../../../src/presentation/editor/theme/themeTokens';
import { openGraphic } from '../../../helpers/assetShapes';

const tokens = { canvasBackground: 'bg', zoneStroke: 'ink', zoneLabel: 'label', zoneCaption: 'muted', accent: 'accent' } as ThemeTokens;
const state = { selected: false, hovered: false, tokens, zoom: 1 };
const element = { id: 'element-sink', kind: 'asset' as const, assetId: 'asset-sink', name: 'Sink', points: placementPoints({ x: 1000, y: 1000 }, 0) };

/** One solid open run and one dashed one, on a shape whose footprint is 800 x 600 about the origin. */
const shape = {
	...expectOk(shapeFromDimensions(800, 600)),
	details: [
		openGraphic('detail-1', [{ x: -100, y: 0 }, { x: 100, y: 0 }]),
		{ ...openGraphic('detail-2', [{ x: -50, y: -50 }, { x: 50, y: 50 }]), line: 'dashed' as const },
	],
};

describe('an open graphic placed on a plan', () => {
	/**
	 * **A stroke, never a region.** `closed` false is what keeps the renderer from drawing the edge
	 * back to the first vertex that the geometry does not contain, and the absent `fill` is C10's
	 * *"open paths remain strokes"* — a `solid` closed graphic is filled with the canvas colour so
	 * it covers what is beneath it, and a line has no interior to cover with.
	 */
	it('draws it unclosed and unfilled, whatever its line says', () => {
		const config = assetShapeConfig(element, () => shape, state);

		expect(config.details[0]).toMatchObject({ name: 'asset-detail', closed: false, stroke: 'ink' });
		expect(config.details[0]).not.toHaveProperty('fill');
		expect(config.details[1]).toMatchObject({ closed: false, dash: [4, 3] });
		expect(config.details[1]).not.toHaveProperty('fill');
	});

	/**
	 * Its LAST point survives the placement. `polygonPolyline` drops each segment's end because the
	 * next one starts there and the last closes onto the first; a path has no closing edge, so the
	 * kind-aware `detailPolyline` is what keeps it — and both endpoints landing where the placement
	 * puts them is the whole of what "remains open" means once it is on a plan.
	 */
	it('keeps both of its endpoints, translated to where the placement sits', () => {
		expect(assetShapeConfig(element, () => shape, state).details[0].points).toEqual([900, 1000, 1100, 1000]);
	});
});
