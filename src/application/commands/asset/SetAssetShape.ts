import { ok } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import type { Command } from '../Command';
import { plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { EntityVersion } from '../../ports/versioning';
import { updateAssetShape, type AssetShapeDeps, type ShapeUnchanged } from './updateAssetShape';

export interface SetAssetShapeInput {
	readonly assetId: AssetId;
	readonly shape: AssetShape;
	readonly expected?: EntityVersion;
}

/**
 * Nothing is compared: re-applying an identical shape writes again, which costs one revision
 * and nothing else (asset designer symbols spec, Decision 7).
 */
const ALWAYS_CHANGED: ShapeUnchanged = () => false;

/**
 * A WHOLE `AssetShape` in one write (asset designer symbols spec, Decision 7) — what a preset
 * produces, and what every part edit of the next increment produces. `updateAssetShape` supplies
 * the lock, the asset-exists check, `validateAssetShape` over this wide input, the conditional
 * write and the `AssetDesignChanged` announcement; the calibration and the background beside the
 * shape are untouched.
 */
export class SetAssetShapeCommand implements Command<SetAssetShapeInput, DispatchResult> {
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: SetAssetShapeInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	executeWithVersion(input: SetAssetShapeInput): Promise<VersionedDispatchResult> {
		return updateAssetShape(this.deps, input, () => ok(input.shape), ALWAYS_CHANGED);
	}
}
