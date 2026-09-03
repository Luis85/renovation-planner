import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { Polygon } from '../../../core/geometry/Polygon';
import { coincident } from '../../../core/geometry/operations';
import type { EventBus } from '../../../core/events/EventBus';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetBackgroundRef } from '../../../domain/asset/Asset';
import { assetDesignChanged } from '../../../domain/asset/Asset.events';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { validateAssetShape } from '../../../domain/asset/AssetShape';
import type { VersionedDispatchResult } from '../DispatchOutcome';
import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
	AssetGeometrySnapshot,
} from '../../ports/AssetGeometrySidecar';
import type { EntityVersion } from '../../ports/versioning';
import type { RepositoryError } from '../../ports/repositoryErrors';
import { assetError, assetNotFound } from '../../../domain/asset/Asset.errors';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { ReferenceLocks } from '../../reference/ReferenceLocks';

/** What every design command is given: an asset, and what it may condition its write on. */
export interface AssetShapeInput {
	readonly assetId: AssetId;
	readonly expected?: EntityVersion;
}

/**
 * The candidate a command proposes, given what is stored and whether coordinates captured on
 * this surface right now still AWAIT A SCALE. Unvalidated on purpose — `updateAssetShape`
 * below runs every candidate through `validateAssetShape`, so the polygon rules and the
 * incoherent-state rules are asked in ONE place for every command rather than once per
 * command.
 *
 * The second parameter used to be `calibrated`, which every caller negated; see
 * `captureAwaitsScale` for why the question is no longer that one.
 */
export type ShapeChange = (
	current: AssetShape | null,
	awaitsScale: boolean,
) => Result<AssetShape, ValidationError>;

/**
 * Would this write change anything? Asked of the fields the CALLING command owns, which is
 * why it is handed in rather than written here: `updateAssetShape` cannot know which of the
 * seven fields a given command is allowed to have moved, and a comparison over all of them
 * would report a write for a field the command inherited unchanged only because the stored
 * value happened to be non-canonical.
 *
 * Both sides have been through `validateAssetShape` — the stored shape at ITS write, the
 * candidate immediately above the call — so a comparison here may assume normalised values.
 */
export type ShapeUnchanged = (current: AssetShape, next: AssetShape) => boolean;

/**
 * The one write path every asset design command takes (SDD §40): read the whole document,
 * let the command propose a shape over what is already there, validate the WHOLE shape, and
 * replace the document conditionally.
 *
 * **It is a function and not a convention.** The property being kept is that a sixth design
 * command cannot forget to announce, and that is only true while there is one function it
 * must call in order to write at all. Five commands go through it across four files — the two
 * footprint ones, the clearance, the anchor and the facing — and each hands in only the two
 * things that differ: WHAT it proposes, and WHICH fields it owns for the purpose of deciding
 * whether anything moved.
 *
 * **`expected ?? version` and never `undefined`.** An unconditional whole-document replace is
 * a lost update the moment two designer leaves show one asset: both read revision N, one sets
 * the anchor, the other the facing, and the later write restores the earlier attribute out of
 * its own stale snapshot with nothing reporting anything. The version this command's own read
 * returned is the weakest honest condition — it refuses exactly the writes that landed since
 * it looked.
 *
 * **The existence check and the write are now in ONE exclusive region, and this paragraph used
 * to record why they were not.** It said closing the gap meant "the port growing an exclusive
 * region a caller can hold across a read and a write, with `ObsidianAssetRepository.delete`
 * holding the SAME one across both of its file operations" — a change to two infrastructure
 * classes. That was the wrong layer to look in. `runDeleteResolution` has held
 * `ReferenceLocks`'s level-1 lock on its entity across `deleteEntity` since design slice 10, so
 * the region existed and the seven sidecar writers were simply not in it; `locks.withLevel1`
 * puts them in it. Reported on PR 43.
 *
 * **What the version condition could not have done instead, because it is the obvious
 * alternative.** `AssetGeometryStore` answers an absent sidecar as a valid empty document at
 * `ABSENT_VERSION` — a CONSTANT — so a command that read `revision: 0`, had the asset deleted
 * under it, and then wrote with `expected: ABSENT_VERSION` met a store reading exactly that,
 * agreed, and created the file. An asset that HAD geometry is protected: expected revision 3
 * against an absent revision 0 refuses. An asset that did not is not, and that is every first
 * footprint, first calibration and first spec sheet.
 *
 * The sidecar's own `KeyedQueues` region is unchanged and still narrower than this one: it is
 * inside `AssetGeometryStore`, keyed per asset, entered only at `read` and `write`, so it makes
 * one write atomic against another write and knows nothing about a NOTE.
 *
 * **What it ANSWERS is `VersionedDispatch`, not a bare outcome.** The version a write
 * produced is known here and nowhere cheaper: a caller rediscovering it with a second read
 * has a window a peer can land in, and the peer's version is then indistinguishable from this
 * gesture's own. The five commands above narrow it back to a plain `DispatchResult` at their
 * `execute` door and hand the whole thing out at `executeWithVersion`, which is the pair
 * `SetRequirementQuantityOverrideCommand` already spells.
 *
 * **`no-write` is a report, not an optimisation.** `ok` is not evidence that anything was
 * written and the save-state indicator infers nothing from it, so a repeated identical
 * attribute has to say so or a "Saved" badge claims a write that did not happen. It returns
 * before the port is reached, which is why a stale `expected` over an unchanged attribute is
 * not a conflict: there is no field the command owns left to lose.
 *
 * **`AssetDesignChanged` is announced for every GEOMETRY command here, and this is not the
 * only place it is published.** The sentence used to read "here and nowhere else", and it was
 * false in the same increment that wrote it — `SetAssetHeightCommand` publishes its own,
 * because a height is the one design field that lives in the note and so takes none of this
 * path. `grep -rn "publish(assetDesignChanged" src/`, run in the edit that wrote this sentence,
 * prints SEVEN real call sites (the pattern also appears once more, inside this very
 * paragraph, which is not a call): this one, `SetAssetHeight.ts`, `CalibrateAsset.ts`, Task
 * B7's `SetAssetBackground.ts`, and THREE restores in
 * `application/editor/asset/ReversibleAssetDesignCommands.ts` — the geometry edit's, the note
 * edit's, and the background edit's, since B7's inverse spans both resources and announces once
 * for the pair rather than once per resource. This sentence read "FIVE" and "the two restores"
 * through Task B6; an undo that announced nothing would leave every peer leaf on the forward
 * state.
 *
 * **And the narrower claim this paragraph used to end on has ALSO stopped being true.** It read
 * "a sixth geometry command cannot forget to announce, because this is the only path by which
 * it can write at all", and Task B6's `CalibrateAssetCommand` is a sixth sidecar writer that
 * does not take this path: this function replaces the `shape` of the document it read, while a
 * calibration replaces the `calibration` beside it in the same file operation. So the
 * guarantee is now scoped to the five commands that DO come through here — a `ShapeChange` can
 * only reach the port through this function — and a writer that composes its own document owes
 * the announcement itself, as `CalibrateAsset` does. Generalising this function to a whole
 * DOCUMENT change was the alternative and is deliberately not taken: `unchanged` is asked of
 * the fields the calling command owns, and a calibration owns fields in both halves.
 *
 * It sits on the `'wrote'` arm alone, BELOW the no-write return and BELOW the
 * port's own answer, because the event means "the stored design changed" rather than
 * "somebody pressed something". A peer designer leaf re-reads on it, and a refresh triggered
 * by an idle re-submit or by a write that refused is a re-read of a document nothing moved.
 */
/**
 * What every design command needs to reach: the sidecar it writes, the repository it checks the
 * asset against, and the bus it announces on.
 *
 * An object rather than three parameters because adding the repository took this function to six
 * and `max-params` is five — the same fold `trashNoteBackedEntity` made at the same limit. It also
 * reads better at the five call sites: the DEPENDENCIES are one argument and the OPERATION is the
 * other three.
 */
export interface AssetShapeDeps {
	readonly sidecar: AssetGeometrySidecar;
	readonly assets: AssetRepository;
	readonly events: EventBus;
	/**
	 * The mutual-exclusion set the DELETE of this asset already holds (PR 43's fourth finding).
	 *
	 * REQUIRED, and that is the point rather than a cost: a `locks?:` would be an exclusive
	 * region whichever caller forgot it silently opted out of, and the failure is a `.rpgeo`
	 * written for an asset that is gone — invisible to every gate, since nothing is wrong with the
	 * code. Making it required named all twelve construction sites at the compiler.
	 *
	 * `ReferenceLocks.withLevel1` is where the reasoning lives, including why the version
	 * condition cannot stand in for it and which asset it fails to protect.
	 */
	readonly locks: ReferenceLocks;
}

/**
 * THE ASSET FIRST, and before the sidecar is even opened — then the sidecar.
 *
 * An absent sidecar is a valid empty document by design — "a shapeless asset, not an error" —
 * so without this, a command against a deleted or invented id wrote a real `.rpgeo`, answered
 * 'wrote', and announced a design change for an asset that is not there. That orphan is the one
 * a reused id later attaches to, defeating the store's `asset-id-mismatch` guard because the two
 * ids then agree; and it re-creates precisely what deleting an asset's sidecar with its asset
 * exists to prevent.
 *
 * The two failure kinds stay APART. `isErr(loaded) || loaded.value === null` reports a vault
 * fault as "the asset is gone", which this repository has shipped three times.
 *
 * `SetAssetHeightCommand` already asked this question — it reads the note, so it had to. The
 * five geometry commands read only the sidecar and so did not, which left one increment
 * shipping six design commands where one checked and five did not.
 *
 * **A FUNCTION since Task B6, because `CalibrateAsset` is the first sidecar writer that does not
 * go through `updateAssetShape`** — it replaces the `calibration` beside the shape, which this
 * function's `unchanged` contract cannot express. Its first draft spelled these eight lines out
 * again and `npm run analyze` reported the pair as a clone group, which is the gate saying what
 * this repository already states in prose: the moment a question worth asking at one door is
 * written out longhand at a second, the count of the places it is missing is unknowable.
 *
 * It answers the SNAPSHOT and drops the `Loaded<Asset>`, because neither caller reads the
 * entity — what they needed the note for was the existence check.
 */
/**
 * What a design command reads before it writes: the sidecar's snapshot, and the one fact
 * about the NOTE that a capture rule needs.
 *
 * The note was always being opened — the existence check above is what opens it — and its
 * background was always being thrown away. `captureAwaitsScale` is what needed it, so the
 * function that reads it hands it back rather than a second `getById` rediscovering it.
 */
export interface AssetDesignRead {
	readonly snapshot: AssetGeometrySnapshot;
	/** The asset's spec sheet, or `null` for an asset with none picked. */
	readonly background: AssetBackgroundRef | null;
}

export async function loadAssetDocument(
	deps: AssetShapeDeps,
	assetId: AssetId,
): Promise<Result<AssetDesignRead, RepositoryError | ReferenceError>> {
	const loaded = await deps.assets.getById(assetId);
	if (isErr(loaded)) return loaded;
	if (loaded.value === null) return err(assetNotFound(assetId));
	const snapshot = await deps.sidecar.read(assetId);
	if (isErr(snapshot)) return snapshot;
	return ok({ snapshot: snapshot.value, background: loaded.value.entity.background });
}

/**
 * Do coordinates captured on this surface RIGHT NOW await a scale, or are they already true
 * millimetres? The one answer, asked once per write and handed to whichever command is
 * proposing a change.
 *
 * **It used to be `!calibrated`, and that was wrong in a way the shipped UI could reach.**
 * Create an asset with a Width and a Depth typed: the designer opens on a drawn 1200 x 800
 * rectangle, in true millimetres, with no background and no calibration. Click *Set anchor*
 * and click a point on it — the coordinates are millimetres, and `!calibrated` recorded them
 * as pending. Pick a background, calibrate, and `rescaled()` faithfully multiplied that
 * anchor by `scaleCorrection` while correctly leaving the typed footprint alone. The anchor
 * lands outside the object, permanently, with `anchorPending` now false so nothing marks it.
 * The same shape for a clearance traced around a typed footprint. Found by a whole-branch
 * review, and reachable entirely through the shipped surface.
 *
 * The three arms, in the order they are asked and for the reason each is asked:
 *
 * - **Calibrated: no.** A scale exists and every coordinate on this surface is in it. This
 *   arm is the whole of what the old rule got right.
 * - **An UNCALIBRATED BACKGROUND: yes.** A spec sheet with no scale is drawn at the
 *   placeholder one source pixel per millimetre, and it is the reason the user is pointing
 *   where they are pointing. This is the arm that keeps `calibrateAsset.test.ts`'s "converts
 *   a pending clearance and leaves a typed footprint alone" a state the UI can still produce:
 *   a clearance traced on a sheet beside a typed footprint really is in the sheet's space.
 * - **No background: yes only while the OBJECT is not already in millimetres.** With no sheet
 *   there is nothing else on the canvas to point at, so a capture is in whatever frame the
 *   object's own footprint establishes. A typed footprint (never pending) establishes
 *   millimetres; a traced-and-still-pending one establishes the placeholder frame it was
 *   drawn in; no footprint at all establishes nothing, and a first outline drawn freehand
 *   still has to be convertible by the calibration that follows it.
 *
 * **What it deliberately does NOT resolve, because nothing can:** an uncalibrated background
 * BESIDE a typed footprint overlays two frames, and a single click cannot say which one the
 * user meant. The second arm resolves that towards the sheet, which is the dominant intent —
 * a user who has just picked a spec sheet is tracing it — and it is an approximation rather
 * than a fact. The reported defect is not in that state: it has no background at all.
 *
 * **Module-private, and that is a fallow finding rather than a preference.** Its only caller is
 * `updateAssetShape` below, in this file; exported, `npm run analyze` reports it as an unused
 * export. Nothing in `tests/` imports it either, and deliberately: every case about this rule
 * drives a real command, because what a reader needs held is that the anchor a user PLACES is
 * not flagged, never that a predicate answers `false`.
 */
function captureAwaitsScale(
	document: AssetGeometryDocument,
	background: AssetBackgroundRef | null,
): boolean {
	if (document.calibration !== null) return false;
	if (background !== null) return true;
	return document.shape === null || document.shape.footprintPending;
}

export async function updateAssetShape(
	deps: AssetShapeDeps,
	input: AssetShapeInput,
	change: ShapeChange,
	unchanged: ShapeUnchanged,
): Promise<VersionedDispatchResult> {
	const { sidecar, events } = deps;
	// The existence check and the write in ONE exclusive region, which is what the paragraph
	// above used to record as an open exposure and no longer does.
	const written = await deps.locks.withLevel1(input.assetId, async () => {
		const read = await loadAssetDocument(deps, input.assetId);
		if (isErr(read)) return read;
		const { document, version } = read.value.snapshot;

		const candidate = change(document.shape, captureAwaitsScale(document, read.value.background));
		if (isErr(candidate)) return candidate;
		const shape = validateAssetShape(candidate.value);
		if (isErr(shape)) return shape;

		if (document.shape !== null && unchanged(document.shape, shape.value)) {
			return ok(null);
		}

		const next: AssetGeometryDocument = { ...document, shape: shape.value };
		return await sidecar.write(input.assetId, next, input.expected ?? version);
	});
	if (isErr(written)) return written;
	// `null` is the no-write arm, carried out of the region rather than returned from inside it:
	// the announcement below must happen OUTSIDE the lock, because `events.publish` awaits its
	// subscribers and a peer leaf's re-read reaches this same asset. Publishing while holding
	// level 1 would run that whole subscriber INSIDE the critical section, lengthening it by the
	// subscriber's own work and blocking other WRITERS of this asset for its duration.
	//
	// CORRECTED 2026-09-03, and PRE-EXISTING rather than introduced by the lock/publish work:
	// this comment used to give the cost as every subscriber's own READ waiting on a lock this
	// command had not let go. No read waits on anything — no read path takes a reference lock at
	// all; every acquirer under `src/` is a command. `ReferenceLocks`'s header carries the grep
	// that measures it. `CalibrateAsset.ts` stated the same wrong rationale and is corrected
	// with it.
	if (written.value === null) return ok({ outcome: 'no-write' });
	await events.publish(assetDesignChanged({ assetId: input.assetId }));
	// The version the WRITE produced, carried out to the caller rather than left to be
	// rediscovered by a second read. A reversible adapter's undo is conditional on it, and a
	// peer landing between this line and a read-back would otherwise be recorded as this
	// gesture's own — see `VersionedDispatch` for the whole of that account.
	return ok({ outcome: 'wrote', version: written.value });
}

/**
 * The precondition the three ATTRIBUTE commands share and the two footprint ones do not: a
 * clearance, an anchor and a facing are each stated relative to a footprint, and an
 * `AssetShape` cannot be built without one. So an asset nobody has drawn an outline on is
 * REFUSED rather than defaulted — inventing a footprint here would store an object whose
 * dimensions nobody authored, and `dimensionsOf` reports that invented rectangle as a
 * measurement.
 *
 * One function with one code and one message rather than three near-identical guards, for
 * the reason this repository already records about a question asked at more than one door:
 * the moment it is spelled out longhand, the count of the places it is missing is
 * unknowable.
 */
export function requireShape(current: AssetShape | null): Result<AssetShape, ValidationError> {
	if (current === null) {
		return err(
			assetError(
				'no-footprint',
				'This asset has no footprint; a clearance, an anchor and a facing are each relative to one.',
			),
		);
	}
	return ok(current);
}

/**
 * Are these two outlines the same outline? The polygon half of two commands' `unchanged`
 * questions — here rather than in `core/geometry/` because it is a question about a WRITE
 * ("would replacing a with b move anything the caller owns"), and the shared answer belongs
 * beside the path that asks it.
 *
 * `coincident` rather than a bitwise comparison, for the reason this repository has recorded
 * twice over: a coordinate that has been through the camera's inverse is never bitwise what
 * it should be, and at 45 degrees there is no exact value to restore — so a re-trace landing
 * a nanometre away is the same outline and must not buy a revision the save indicator then
 * reports as a save.
 */
export function samePolygon(a: Polygon, b: Polygon): boolean {
	return (
		a.points.length === b.points.length &&
		a.points.every((point, index) => coincident(point, b.points[index]))
	);
}
