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
import { footprintFromDimensions, type AssetShape } from '../../src/domain/asset/AssetShape';
import type { AssetDesignDto, AssetDesignError } from '../../src/application/queries/GetAssetDesign';
import type { Result } from '../../src/core/result/Result';
import type { ValidationError } from '../../src/core/errors/AppError';
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

/**
 * The inspector's `editShape` is the leaf's own `EditShape` since AD18-R17, whose edit may answer `null`
 * for "nothing to do" (a corner radius committed at the radius it has). A case that never commits one
 * uses this to refuse it loudly rather than let a fake invent a result.
 */
export function handed(result: Result<AssetShape, ValidationError> | null): Result<AssetShape, ValidationError> {
	if (result === null) throw new Error('an edit answered nothing to do; this fake does not model it');
	return result;
}

/**
 * A vault read that failed outright — the one `AssetDesignError` every designer-refresh fixture in
 * this directory reaches for. `designerUsageScope.test.ts` keeps its OWN `VAULT_FAILED`: a different
 * message and no explicit `AssetDesignError` type, so it is a different fixture and not a copy of
 * this one.
 */
export const VAULT_FAILED: AssetDesignError = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the vault could not be read',
};

export function assetDesign(overrides: Partial<AssetDesignDto> = {}): AssetDesignDto {
	const assetId: AssetId = overrides.assetId ?? createAssetId();
	return {
		assetId,
		name: 'Base cabinet 600',
		category: 'furniture',
		height: 900,
		// A default this thing HAS, not the absence `noBackground` cases explicitly opt into:
		// several existing fixtures at `assetDesign({ shape: null })` rely on the background
		// default staying non-null so the selector's `noShape` arm is what they still exercise.
		background: { path: 'Specs/base-cabinet.png', kind: 'image', page: null },
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
			details: [],
		},
		dimensions: { width: 1200, depth: 800 },
		clearanceExtent: null,
		dimensionsUnscaled: false,
		noteVersion: { revision: 1, observed: observationToken('note-1') },
		geometryVersion: { revision: 1, observed: observationToken('geometry-1') },
		...overrides,
	};
}
