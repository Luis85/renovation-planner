/**
 * One `AssetDesignDto` fixture, so the designer's selector, its root and its view all describe
 * the SAME asset.
 *
 * A factory rather than a frozen literal: three of its consumers vary one field
 * (`shape`, `calibration`, `height`) and a shared constant would make each of them state the
 * other six again to change one. Every id and token is minted through the real branding
 * helpers rather than asserted into place, because `tests/**` is type-checked by
 * `npm run build` and a fixture that casts is a fixture the compiler stops reading.
 */
import { createAssetId, type AssetId } from '../../src/domain/asset/AssetId';
import { footprintFromDimensions } from '../../src/domain/asset/AssetShape';
import type { AssetDesignDto } from '../../src/application/queries/GetAssetDesign';
import { expectOk, observationToken } from './domain';

/**
 * A footprint an asset really could carry, built through the DOMAIN's own constructor rather
 * than asserted into `Polygon`: 1200 x 800, centred on the origin, which is what makes the
 * default anchor `{ x: 0, y: 0 }` mean the middle of the object. `footprintFromDimensions`
 * refuses a non-positive dimension, so `expectOk` here fails loudly rather than the fixture
 * quietly standing in for a shape the domain would not accept.
 *
 * NOT exported: `assetDesign` below is its only reader, and an export with no consumer is an
 * `unused-exports` finding — `npm run analyze` reported exactly that on its first draft.
 */
const FIXTURE_FOOTPRINT = expectOk(footprintFromDimensions(1200, 800));

export function assetDesign(overrides: Partial<AssetDesignDto> = {}): AssetDesignDto {
	const assetId: AssetId = overrides.assetId ?? createAssetId();
	return {
		assetId,
		name: 'Base cabinet 600',
		height: 900,
		calibration: null,
		shape: {
			footprint: FIXTURE_FOOTPRINT,
			footprintOrigin: 'typed',
			footprintPending: false,
			clearance: null,
			clearancePending: false,
			anchor: { x: 0, y: 0 },
			anchorPending: false,
			facing: 0,
		},
		dimensions: { width: 1200, depth: 800 },
		dimensionsUnscaled: false,
		noteVersion: { revision: 1, observed: observationToken('note-1') },
		geometryVersion: { revision: 1, observed: observationToken('geometry-1') },
		...overrides,
	};
}
