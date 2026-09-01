import { isErr, ok } from '../../../core/result/Result';
import type { Point } from '../../../core/geometry/Point';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { Command } from '../Command';
import { plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { EntityVersion } from '../../ports/versioning';
import { requireShape, samePolygon, updateAssetShape, type AssetShapeDeps } from './updateAssetShape';

export interface SetAssetClearanceInput {
	readonly assetId: AssetId;
	/** The boundary's vertices, or `null` to remove the boundary this asset has. */
	readonly points: readonly Point[] | null;
	readonly expected?: EntityVersion;
}

/**
 * Would this write change anything? Asked of the two fields this command OWNS and no
 * others, which is what stops it reporting a write for a facing or an anchor it merely
 * inherited.
 *
 * Absence is a value here, not a gap: a removal over an asset that has no boundary anyway
 * really does change nothing, and the `null`/`null` arm is what says so rather than falling
 * through to a polygon comparison that has nothing to compare.
 *
 * `clearancePending` is compared beside the coordinates for the reason `sameFootprint` gives
 * about provenance: a boundary re-traced at the identical coordinates on a now-calibrated
 * surface really HAS changed, and a comparison over coordinates alone would leave it flagged
 * as awaiting a scale forever.
 */
function sameClearance(current: AssetShape, next: AssetShape): boolean {
	if (current.clearancePending !== next.clearancePending) return false;
	if (current.clearance === null || next.clearance === null) {
		return current.clearance === next.clearance;
	}
	return samePolygon(current.clearance, next.clearance);
}

/**
 * An asset's clearance boundary: the space it needs around itself, drawn as its own outline
 * over the same reference image the footprint was traced on (§88).
 *
 * **`clearancePending` is recorded AT CAPTURE** from whether that surface carried a scale — a
 * fact about the past, never re-derived later from whether a calibration happens to exist
 * now, which would re-flag a genuinely measured boundary the moment its background was
 * replaced. One flag per coordinate group: this command sets its own and neither of the
 * other two, because a clearance capture is not an event in the footprint's history or the
 * anchor's. Whether the surface carried a scale is `captureAwaitsScale`'s question — a
 * boundary drawn around a TYPED footprint with no spec sheet is already in millimetres, which
 * `!calibrated` could not say.
 *
 * **Removal is not a capture.** `points: null` clears the flag UNCONDITIONALLY rather than
 * deriving it from the surface, because there are no coordinates left for a scale to convert
 * and a flag saying otherwise hands a future recalibration a group to rescale that does not
 * exist. That is not merely tidier: `validateAssetShape` refuses a pending flag on an absent
 * clearance outright, so a build deriving the flag from calibration alone fails at the write
 * on an uncalibrated surface rather than persisting a state its reader would have to
 * interpret.
 *
 * The points cross into the domain unvalidated and are refused by the one polygon validator
 * through `validateAssetShape`, rather than by a `createPolygon` call here that would leave
 * that validator's own arm unreachable — the dead-guard shape this repository has already
 * paid for.
 */
export class SetAssetClearanceCommand implements Command<SetAssetClearanceInput, DispatchResult> {
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: SetAssetClearanceInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	/**
	 * The reversible adapter's door: the same write, plus the version it produced. `execute`
	 * is the plain caller's and drops that fact — the pair `SetRequirementQuantityOverrideCommand`
	 * already spells, and the reason it is a pair rather than a widening is in `VersionedDispatch`.
	 */
	executeWithVersion(input: SetAssetClearanceInput): Promise<VersionedDispatchResult> {
		return updateAssetShape(
			this.deps,
			input,
			(current, awaitsScale) => {
				const shape = requireShape(current);
				if (isErr(shape)) return shape;
				if (input.points === null) {
					return ok({ ...shape.value, clearance: null, clearancePending: false });
				}
				return ok({
					...shape.value,
					clearance: { points: input.points },
					clearancePending: awaitsScale,
				});
			},
			sameClearance,
		);
	}
}
