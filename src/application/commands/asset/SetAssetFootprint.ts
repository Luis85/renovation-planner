import { isErr, ok, type Result } from '../../../core/result/Result';
import type { ValidationError } from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import type { Polygon } from '../../../core/geometry/Polygon';
import { coincident } from '../../../core/geometry/operations';
import type { EventBus } from '../../../core/events/EventBus';
import type { AssetId } from '../../../domain/asset/AssetId';
import { assetDesignChanged } from '../../../domain/asset/Asset.events';
import type { AssetShape, FootprintOrigin } from '../../../domain/asset/AssetShape';
import { footprintFromDimensions, validateAssetShape } from '../../../domain/asset/AssetShape';
import type { Command } from '../Command';
import type { DispatchResult } from '../DispatchOutcome';
import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
} from '../../ports/AssetGeometrySidecar';
import type { EntityVersion } from '../../ports/versioning';

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

/**
 * The candidate a command proposes, given what is stored and whether the surface it was
 * captured on carries a scale. Unvalidated on purpose — `setFootprint` below runs every
 * candidate through `validateAssetShape`, so the polygon rules and the incoherent-state
 * rules are asked in ONE place for both commands rather than once per command.
 */
type FootprintChange = (
	current: AssetShape | null,
	calibrated: boolean,
) => Result<AssetShape, ValidationError>;

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
 * `coincident` rather than `===`, for the same reason the anchor uses it: a coordinate
 * that has been through the camera's inverse is never bitwise what it should be, and a
 * re-trace landing a nanometre away is the same outline. Provenance and the pending flag
 * are compared too — a traced outline retraced at the identical coordinates on a
 * now-calibrated surface really has changed, and a comparison over coordinates alone
 * would leave it flagged as awaiting a scale forever.
 */
function sameFootprint(current: AssetShape, next: AssetShape): boolean {
	const a = current.footprint.points;
	const b = next.footprint.points;
	return (
		current.footprintOrigin === next.footprintOrigin &&
		current.footprintPending === next.footprintPending &&
		a.length === b.length &&
		a.every((point, index) => coincident(point, b[index]))
	);
}

/**
 * The one write path both commands take (SDD §40): read the whole document, let the
 * command propose a footprint over what is already there, validate the WHOLE shape, and
 * replace the document conditionally.
 *
 * **`expected ?? version` and never `undefined`.** An unconditional whole-document
 * replace is a lost update the moment two designer leaves show one asset: both read
 * revision N, one sets the anchor, the other the facing, and the later write restores the
 * earlier attribute out of its own stale snapshot with nothing reporting anything. The
 * version this command's own read returned is the weakest honest condition — it refuses
 * exactly the writes that landed since it looked.
 *
 * **`no-write` is a report, not an optimisation.** `ok` is not evidence that anything was
 * written and the save-state indicator infers nothing from it, so a repeated identical
 * footprint has to say so or a "Saved" badge claims a write that did not happen. It
 * returns before the port is reached, which is why a stale `expected` over an unchanged
 * footprint is not a conflict: there is no field this command owns left to lose.
 *
 * **`AssetDesignChanged` is announced here and nowhere else in this module** — measured
 * rather than asserted: grepping this file for `events\.publish` prints exactly one line, the
 * one below. (The narrower pattern rather than the bare word, which this paragraph matches
 * too.) Both commands announce through it because both WRITE through it, so a third
 * design command added to this file cannot forget; and it sits on the `'wrote'` arm alone,
 * BELOW the no-write return and BELOW the port's own answer, because the event means "the
 * stored design changed" rather than "somebody pressed something". A peer designer leaf
 * re-reads on it, and a refresh triggered by an idle re-submit or by a write that refused is
 * a re-read of a document nothing moved.
 */
async function setFootprint(
	sidecar: AssetGeometrySidecar,
	events: EventBus,
	input: { readonly assetId: AssetId; readonly expected?: EntityVersion },
	change: FootprintChange,
): Promise<DispatchResult> {
	const snapshot = await sidecar.read(input.assetId);
	if (isErr(snapshot)) return snapshot;
	const { document, version } = snapshot.value;

	const candidate = change(document.shape, document.calibration !== null);
	if (isErr(candidate)) return candidate;
	const shape = validateAssetShape(candidate.value);
	if (isErr(shape)) return shape;

	if (document.shape !== null && sameFootprint(document.shape, shape.value)) {
		return ok('no-write');
	}

	const next: AssetGeometryDocument = { ...document, shape: shape.value };
	const written = await sidecar.write(input.assetId, next, input.expected ?? version);
	if (isErr(written)) return written;
	await events.publish(assetDesignChanged({ assetId: input.assetId }));
	return ok('wrote');
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
	constructor(
		private readonly sidecar: AssetGeometrySidecar,
		private readonly events: EventBus,
	) {}

	execute(input: SetAssetFootprintFromDimensionsInput): Promise<DispatchResult> {
		return setFootprint(this.sidecar, this.events, input, (current) => {
			const footprint = footprintFromDimensions(input.width, input.depth);
			if (isErr(footprint)) return footprint;
			return ok(withFootprint(current, footprint.value, 'typed', false));
		});
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
	constructor(
		private readonly sidecar: AssetGeometrySidecar,
		private readonly events: EventBus,
	) {}

	execute(input: SetAssetFootprintInput): Promise<DispatchResult> {
		return setFootprint(this.sidecar, this.events, input, (current, calibrated) =>
			ok(withFootprint(current, { points: input.points }, 'traced', !calibrated)),
		);
	}
}
