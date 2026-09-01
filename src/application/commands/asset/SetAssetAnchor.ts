import { isErr, ok } from '../../../core/result/Result';
import type { Point } from '../../../core/geometry/Point';
import { coincident } from '../../../core/geometry/operations';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { Command } from '../Command';
import { plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { EntityVersion } from '../../ports/versioning';
import { requireShape, updateAssetShape, type AssetShapeDeps } from './updateAssetShape';

export interface SetAssetAnchorInput {
	readonly assetId: AssetId;
	readonly anchor: Point;
	readonly expected?: EntityVersion;
}

/**
 * Would this write change anything? Asked of the two fields this command OWNS.
 *
 * **`coincident` and never `===`.** The anchor is the one attribute here a user places by
 * pointing at it, so its coordinates arrive through the camera's inverse — and a value that
 * has been through that arithmetic is never bitwise what it should be. Under `===` a re-place
 * a nanometre away buys a revision, an event every peer designer leaf re-reads on, and a
 * "Saved" badge for a move nobody made. Eight orders of magnitude above floating-point dust
 * and five below anything a pointer can express at the tightest zoom, so no two anchors a
 * user MEANT to be distinct can collide.
 */
function sameAnchor(current: AssetShape, next: AssetShape): boolean {
	return current.anchorPending === next.anchorPending && coincident(current.anchor, next.anchor);
}

/**
 * The anchor: the point of the object that lands where a user drops it on a plan (§88).
 *
 * A shape nobody has anchored carries `{ x: 0, y: 0 }`, which is the CENTRE of a typed
 * rectangle rather than a corner nobody chose — `footprintFromDimensions` centres on the
 * origin precisely so that default means something.
 *
 * **`anchorPending` is recorded AT CAPTURE**, like every other flag here: an anchor pointed
 * at on an unscaled surface is in placeholder coordinates awaiting a scale, and that is a
 * fact about the moment it was placed rather than about whether a calibration exists now.
 * This command sets its own flag and neither of the other two.
 *
 * **What "an unscaled surface" IS, is `captureAwaitsScale`'s question and not `!calibrated`.**
 * This command was the reported instance of that difference: an anchor clicked onto a TYPED
 * footprint with no spec sheet is in true millimetres, and the old rule flagged it pending and
 * let the next calibration multiply it out of the object.
 *
 * The coordinates cross into the domain unvalidated and are refused for finiteness by
 * `validateAssetShape`, so the one anchor rule lives at the one place that states it.
 */
export class SetAssetAnchorCommand implements Command<SetAssetAnchorInput, DispatchResult> {
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: SetAssetAnchorInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	/**
	 * The reversible adapter's door: the same write, plus the version it produced. `execute`
	 * is the plain caller's and drops that fact — the pair `SetRequirementQuantityOverrideCommand`
	 * already spells, and the reason it is a pair rather than a widening is in `VersionedDispatch`.
	 */
	executeWithVersion(input: SetAssetAnchorInput): Promise<VersionedDispatchResult> {
		return updateAssetShape(
			this.deps,
			input,
			(current, awaitsScale) => {
				const shape = requireShape(current);
				if (isErr(shape)) return shape;
				return ok({ ...shape.value, anchor: input.anchor, anchorPending: awaitsScale });
			},
			sameAnchor,
		);
	}
}
