import { isErr, ok } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { Command } from '../Command';
import { plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { EntityVersion } from '../../ports/versioning';
import { requireShape, updateAssetShape, type AssetShapeDeps } from './updateAssetShape';

export interface SetAssetFacingInput {
	readonly assetId: AssetId;
	/** Radians, measured anticlockwise from +x. Normalised into `[0, 2π)` on the way in. */
	readonly facing: number;
	readonly expected?: EntityVersion;
}

/**
 * Would this write change anything? One field, compared bitwise — and the asymmetry with the
 * anchor's `coincident` is deliberate rather than an oversight.
 *
 * Both sides have already been NORMALISED by `validateAssetShape`, the stored one at its own
 * write and the candidate immediately above this call, so `2π` against a stored `0` is
 * `0 === 0` here and reports the no-write it is. That normalisation is what makes an exact
 * comparison honest: the two spellings a user can actually produce for one direction have
 * already been folded into one before this is asked.
 *
 * What is NOT claimed is a tolerance. A facing is a single scalar rather than a coordinate
 * pair, nothing has put it through a camera's inverse, and there is no gesture producing one
 * yet. The day a rotate handle exists, this is the line that owes an angular tolerance, and
 * it will owe it in its own units — a distance tolerance in millimetres says nothing about
 * radians.
 */
function sameFacing(current: AssetShape, next: AssetShape): boolean {
	return current.facing === next.facing;
}

/**
 * Which way the object faces: radians anticlockwise from +x (§88).
 *
 * **It owns no pending flag, and that is a statement rather than an omission.** The three
 * flags say when a COORDINATE GROUP was captured, and a coordinate group is what a scale
 * converts. An angle survives a rescale unchanged, so there is nothing for a calibration to
 * do to a facing and nothing for a flag to record — which is why this command must leave all
 * three flags exactly where it found them, its own included, there being no own.
 *
 * The angle crosses into the domain unnormalised and unvalidated: `validateAssetShape`
 * refuses a non-finite one and folds every other into `[0, 2π)`, so one direction has one
 * spelling and no caller has to remember to fold it.
 */
export class SetAssetFacingCommand implements Command<SetAssetFacingInput, DispatchResult> {
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: SetAssetFacingInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	/**
	 * The reversible adapter's door: the same write, plus the version it produced. `execute`
	 * is the plain caller's and drops that fact — the pair `SetRequirementQuantityOverrideCommand`
	 * already spells, and the reason it is a pair rather than a widening is in `VersionedDispatch`.
	 */
	executeWithVersion(input: SetAssetFacingInput): Promise<VersionedDispatchResult> {
		return updateAssetShape(
			this.deps,
			input,
			(current) => {
				const shape = requireShape(current);
				if (isErr(shape)) return shape;
				return ok({ ...shape.value, facing: input.facing });
			},
			sameFacing,
		);
	}
}
