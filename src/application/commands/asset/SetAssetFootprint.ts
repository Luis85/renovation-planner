import { isErr, ok } from '../../../core/result/Result';
import type { Point } from '../../../core/geometry/Point';
import type { Polygon } from '../../../core/geometry/Polygon';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetShape, FootprintOrigin } from '../../../domain/asset/AssetShape';
import { footprintFromDimensions } from '../../../domain/asset/AssetShape';
import type { Command } from '../Command';
import { plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { EntityVersion } from '../../ports/versioning';
import { samePolygon, updateAssetShape, type AssetShapeDeps } from './updateAssetShape';

export interface SetAssetFootprintFromDimensionsInput {
	readonly assetId: AssetId;
	readonly width: number;
	readonly depth: number;
	readonly expected?: EntityVersion;
}

export interface SetAssetFootprintInput {
	readonly assetId: AssetId;
	readonly points: readonly Point[];
	readonly expected?: EntityVersion;
}

/**
 * The fields a footprint command INHERITS — everything an `AssetShape` holds that is not
 * the footprint, its provenance or its pending flag.
 *
 * Spelled as a `Pick` rather than as a whole shape with a placeholder footprint, so the
 * set is derived from `AssetShape` and a seventh field cannot be added to the domain
 * without this failing to compile. Setting a footprint must never clear a clearance, an
 * anchor or a facing, and it must not touch `clearancePending` or `anchorPending`: those
 * flags say when THOSE coordinate groups were captured, and a footprint capture is not an
 * event in their history.
 */
type InheritedShape = Pick<
	AssetShape,
	'clearance' | 'clearancePending' | 'anchorPending' | 'anchor' | 'facing'
>;

/** What an asset nobody has drawn on yet inherits: nothing, centred, facing +x. */
const UNDESIGNED: InheritedShape = {
	clearance: null,
	clearancePending: false,
	anchorPending: false,
	anchor: { x: 0, y: 0 },
	facing: 0,
};

function withFootprint(
	current: AssetShape | null,
	footprint: Polygon,
	footprintOrigin: FootprintOrigin,
	footprintPending: boolean,
): AssetShape {
	const inherited: InheritedShape = current ?? UNDESIGNED;
	return { ...inherited, footprint, footprintOrigin, footprintPending };
}

/**
 * Would this write change anything? Asked of the three fields these commands OWN, which
 * is sufficient precisely because they own nothing else: every other field is inherited
 * from the stored shape unchanged, and the facing is already normalised, having come back
 * through `validateAssetShape` at the read.
 *
 * The coordinates go through `samePolygon`, which is `coincident` rather than `===` for the
 * same reason `SetAssetAnchor` gives. Provenance and the pending flag are compared too — a traced outline retraced at the identical coordinates on a
 * now-calibrated surface really has changed, and a comparison over coordinates alone
 * would leave it flagged as awaiting a scale forever.
 */
function sameFootprint(current: AssetShape, next: AssetShape): boolean {
	return (
		current.footprintOrigin === next.footprintOrigin &&
		current.footprintPending === next.footprintPending &&
		samePolygon(current.footprint, next.footprint)
	);
}

/**
 * A width and a depth in millimetres become the asset's footprint (§88, design slice A5).
 *
 * The rectangle is CENTRED on the origin, which is what makes the default anchor mean the
 * middle of the object rather than a corner nobody chose; `footprintFromDimensions` owns
 * that and every refusal about the numbers themselves.
 *
 * Typed geometry is never pending. The dimensions are authored in millimetres, so no
 * scale is owed for them and the surface's calibration says nothing about them — which is
 * why this command ignores the `calibrated` half of a change and `validateAssetShape`
 * refuses a typed footprint marked pending outright.
 */
export class SetAssetFootprintFromDimensionsCommand
	implements Command<SetAssetFootprintFromDimensionsInput, DispatchResult>
{
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: SetAssetFootprintFromDimensionsInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	/**
	 * The reversible adapter's door: the same write, plus the version it produced. `execute`
	 * is the plain caller's and drops that fact — the pair `SetRequirementQuantityOverrideCommand`
	 * already spells, and the reason it is a pair rather than a widening is in `VersionedDispatch`.
	 */
	executeWithVersion(input: SetAssetFootprintFromDimensionsInput): Promise<VersionedDispatchResult> {
		return updateAssetShape(this.deps, input, (current) => {
			const footprint = footprintFromDimensions(input.width, input.depth);
			if (isErr(footprint)) return footprint;
			return ok(withFootprint(current, footprint.value, 'typed', false));
		}, sameFootprint);
	}
}

/**
 * An outline traced over the asset's reference image becomes its footprint.
 *
 * `footprintPending` is recorded AT CAPTURE from whether that surface carried a scale —
 * a fact about the past, never re-derived later from whether a calibration happens to
 * exist now, which would re-flag a genuinely measured outline the moment its background
 * was replaced.
 *
 * The points cross into the domain unvalidated and are refused by the one polygon
 * validator through `validateAssetShape`, rather than by a `createPolygon` call here that
 * would leave that validator's own arm unreachable — the dead-guard shape this repository
 * has already paid for.
 */
export class SetAssetFootprintCommand
	implements Command<SetAssetFootprintInput, DispatchResult>
{
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: SetAssetFootprintInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	/**
	 * The reversible adapter's door: the same write, plus the version it produced. `execute`
	 * is the plain caller's and drops that fact — the pair `SetRequirementQuantityOverrideCommand`
	 * already spells, and the reason it is a pair rather than a widening is in `VersionedDispatch`.
	 */
	executeWithVersion(input: SetAssetFootprintInput): Promise<VersionedDispatchResult> {
		return updateAssetShape(
			this.deps,
			input,
			(current, calibrated) =>
				ok(withFootprint(current, { points: input.points }, 'traced', !calibrated)),
			sameFootprint,
		);
	}
}
