import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { Point } from '../../../core/geometry/Point';
import { scale as scaleShape } from '../../../core/geometry/operations';
import { assetDesignChanged } from '../../../domain/asset/Asset.events';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { validateAssetShape } from '../../../domain/asset/AssetShape';
import type { Calibration } from '../../../domain/plan/Calibration';
import { deriveCalibration, nonFiniteRescaleError } from '../../../domain/plan/Calibration';
import type { Command } from '../Command';
import { plainDispatch, type DispatchResult, type VersionedDispatchResult } from '../DispatchOutcome';
import type { AssetGeometryDocument } from '../../ports/AssetGeometrySidecar';
import type { EntityVersion } from '../../ports/versioning';
import { loadAssetDocument, type AssetShapeDeps, type AssetShapeInput } from './updateAssetShape';

/**
 * What one calibration gesture on the ASSET designer supplies (Task B6).
 *
 * It extends `AssetShapeInput` rather than restating its two members, which is what makes a
 * `CalibrateAssetInput` acceptable to `ReversibleAssetGeometryEdit` — that adapter is generic
 * over `TInput extends AssetShapeInput`, because every design gesture is about one asset and
 * may condition its write on what the caller read.
 *
 * `pointA` and `pointB` are in the ASSET's current world units, exactly as
 * `CalibratePlanInput`'s are in the plan's: the two coincide with the background's pixel space
 * only while the asset is uncalibrated and its placeholder scale is `1`.
 */
export interface CalibrateAssetInput extends AssetShapeInput {
	readonly pointA: Point;
	readonly pointB: Point;
	/** World units (mm) — like every length here (ADR-009). */
	readonly knownDistance: number;
}

/** Every rescale anchors at the world origin, so alignment between coordinate groups survives. */
const ORIGIN: Point = { x: 0, y: 0 };

/**
 * The shape with every coordinate group that AWAITS a scale converted, and none that does not.
 *
 * **One flag per group, and no conjunction with provenance.** `footprintOrigin` stays `'traced'`
 * for the life of an outline, so it can say where coordinates came from and never what has
 * already happened to them; a shape-level flag cannot tell a typed footprint from a clearance
 * traced beside it. Three flags remove the question rather than answering it.
 *
 * **Every flag comes down, including the ones this call did not convert, and that is correct
 * rather than convenient.** A group whose flag was already clear is already in millimetres, so
 * `false` over `false` changes nothing; the one arrangement in which a set flag could survive a
 * calibration is a pending flag on an ABSENT clearance, which `validateAssetShape` refuses
 * outright. After a calibration nothing on this asset awaits a scale, which is the whole of
 * what these flags mean.
 */
function rescaled(shape: AssetShape, correction: number): AssetShape {
	return {
		...shape,
		footprint: shape.footprintPending ? scaleShape(shape.footprint, correction, ORIGIN) : shape.footprint,
		footprintPending: false,
		clearance:
			shape.clearance !== null && shape.clearancePending
				? scaleShape(shape.clearance, correction, ORIGIN)
				: shape.clearance,
		clearancePending: false,
		anchor: shape.anchorPending ? scaleShape(shape.anchor, correction, ORIGIN) : shape.anchor,
		anchorPending: false,
	};
}

function pointsFinite(points: readonly Point[]): boolean {
	return points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

/**
 * Would this document survive being written and read back? `ReversibleCalibratePlan`'s
 * finite-result guard, asked of an asset's coordinate groups instead of a plan's objects.
 *
 * A finite ratio does not mean a finite PRODUCT: a legal-looking pick (a measured ~1e-302
 * against a known 3200) derives a finite correction whose product with an ordinary 600 mm
 * coordinate is `Infinity`, and `JSON.stringify` writes that as `null` — leaving a sidecar the
 * schema then refuses on every later read. Refusing the calibration keeps the file readable.
 */
function documentFinite(calibration: Calibration, shape: AssetShape | null): boolean {
	if (!pointsFinite([calibration.pointA, calibration.pointB])) return false;
	if (shape === null) return true;
	return (
		pointsFinite(shape.footprint.points)
		&& pointsFinite(shape.clearance?.points ?? [])
		&& pointsFinite([shape.anchor])
	);
}

/**
 * An asset's OWN calibration (Task B6, PRD §88): two picked points, the real distance between
 * them, and the rescale of whatever on this object was captured before a scale existed.
 *
 * **The one place slice 7's plan rule may NOT be copied.** `ReversibleCalibratePlanCommand`
 * multiplies every coordinate the plan owns, and that is right there because every one of them
 * was drawn on the background at the placeholder scale of 1. An asset has a coordinate source a
 * plan never had: a typed 1200 x 800 is authored in true millimetres and was never in the
 * background's space, so rescaling it turns an exact oven into an arbitrary one — silently,
 * because the result still looks like a plausible oven. The derivation is shared with the plan
 * and the rescale is not.
 *
 * **Two steps, gated differently.** The calibration's OWN pair is rescaled unconditionally,
 * because the at-rest invariant `distance(pointA, pointB) === knownDistance` is definitional and
 * every pending flag is clear on the ordinary first calibration — a background measured before
 * anything is drawn on it. Gating the pair would store a 100-unit segment claiming a known
 * distance of 200. Each coordinate GROUP is then rescaled on its own flag; see `rescaled`.
 *
 * **The accepted cost, named rather than hidden:** correcting a calibration no longer
 * retroactively repairs an earlier trace. A footprint measured under the first calibration is
 * not pending, so a second calibration leaves it exactly where it is and the user re-traces.
 * The alternative — gating on provenance — re-multiplies millimetres by a correction that
 * answers a question about pixels.
 *
 * **`validateAssetShape` over the RESCALED shape**, which the plan's equivalent has no need of:
 * `ObsidianAssetGeometrySidecar` validates what it READS and refuses rather than repairing, so
 * a correction small enough to collapse a footprint's area would otherwise write a document
 * this plugin can never read again. The finite guard above catches the overflow end of that
 * class; this catches the underflow end.
 *
 * The write is CONDITIONAL on what this execute's own read returned unless the caller presented
 * its own expectation — `updateAssetShape` states the whole of that argument, and this command
 * does not go through it for one reason: that function replaces the `shape` of the document it
 * read, while a calibration replaces the `calibration` beside it in the same file operation.
 * `AssetDesignChanged` is announced here for the reason it is announced there — a peer designer
 * leaf showing this asset is drawing coordinates this write just moved.
 */
export class CalibrateAssetCommand implements Command<CalibrateAssetInput, DispatchResult> {
	constructor(private readonly deps: AssetShapeDeps) {}

	execute(input: CalibrateAssetInput): Promise<DispatchResult> {
		return plainDispatch(this.executeWithVersion(input));
	}

	/**
	 * The reversible adapter's door: the same write, plus the version it produced. The pair the
	 * five shape commands already spell, and the reason it is a pair rather than a widening is
	 * in `VersionedDispatch`.
	 */
	async executeWithVersion(input: CalibrateAssetInput): Promise<VersionedDispatchResult> {
		const { sidecar, events, locks } = this.deps;
		// The whole read-derive-write in ONE exclusive region, for `updateAssetShape`'s reason:
		// the existence check below is asked in the application layer, and without the lock an
		// asset deleted between it and the write leaves a `.rpgeo` for an asset that is gone.
		// `ReferenceLocks.withLevel1` carries the account, including why the version condition
		// cannot stand in for it on an asset that has no geometry yet — which is every FIRST
		// calibration, and therefore every calibration this command has ever taken on a
		// freshly created asset.
		//
		// The closure's return type is ANNOTATED, not inferred, and that is the same lesson
		// `SetPlanBackgroundCommand`'s own `execute` records: inference produces a UNION of
		// `Result`s — one arm per error type the body can return — which is not the same type as
		// one `Result` over a union of errors, and `isErr` cannot narrow it. Measured rather
		// than anticipated: without the annotation the compiler refuses both the narrowing and
		// the `.value` read below.
		const written = await locks.withLevel1<Result<EntityVersion, AppError>>(input.assetId, async () => {
			// THE ASSET FIRST and the sidecar second, through the one function that asks it — a
			// calibration writing a real `.rpgeo` for an invented id leaves exactly the orphan that
			// check exists to prevent, and `loadAssetDocument` carries the whole argument.
			const read = await loadAssetDocument(this.deps, input.assetId);
			if (isErr(read)) return read;
			// The background this read also carries is nothing to a calibration: `rescaled` below
			// keys on the per-group flags a CAPTURE recorded, never on the surface as it stands now.
			const { document, version } = read.value.snapshot;

			const derived = deriveCalibration(
				input.pointA,
				input.pointB,
				input.knownDistance,
				document.calibration,
			);
			if (isErr(derived)) return derived;
			const { calibration, scaleCorrection } = derived.value;

			const calibrated: Calibration = {
				...calibration,
				pointA: scaleShape(calibration.pointA, scaleCorrection, ORIGIN),
				pointB: scaleShape(calibration.pointB, scaleCorrection, ORIGIN),
			};
			const shape = document.shape === null ? null : rescaled(document.shape, scaleCorrection);
			if (!documentFinite(calibrated, shape)) return err(nonFiniteRescaleError());
			const checked = shape === null ? null : validateAssetShape(shape);
			if (checked !== null && isErr(checked)) return checked;

			const next: AssetGeometryDocument = {
				calibration: calibrated,
				shape: checked === null ? null : checked.value,
			};
			return await sidecar.write(input.assetId, next, input.expected ?? version);
		});
		if (isErr(written)) return written;
		// OUTSIDE the region: `events.publish` awaits its subscribers and a peer designer leaf
		// re-reads this same asset on it, so announcing while still holding level 1 would run
		// that subscriber INSIDE the critical section — lengthening it by the subscriber's own
		// work and blocking other WRITERS of this asset for its duration.
		//
		// CORRECTED 2026-09-03, and PRE-EXISTING rather than introduced by the lock/publish
		// work: this comment used to give the cost as every subscriber's own READ waiting on a
		// lock this command had not let go. No read waits on anything — no read path takes a
		// reference lock at all. `ReferenceLocks`'s header carries the grep that measures it;
		// `updateAssetShape.ts` stated the same wrong rationale and is corrected with it.
		await events.publish(assetDesignChanged({ assetId: input.assetId }));
		return ok({ outcome: 'wrote', version: written.value });
	}
}
