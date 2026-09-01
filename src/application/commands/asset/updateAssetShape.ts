import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { Polygon } from '../../../core/geometry/Polygon';
import { coincident } from '../../../core/geometry/operations';
import type { EventBus } from '../../../core/events/EventBus';
import type { AssetId } from '../../../domain/asset/AssetId';
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

/** What every design command is given: an asset, and what it may condition its write on. */
export interface AssetShapeInput {
	readonly assetId: AssetId;
	readonly expected?: EntityVersion;
}

/**
 * The candidate a command proposes, given what is stored and whether the surface it was
 * captured on carries a scale. Unvalidated on purpose — `updateAssetShape` below runs every
 * candidate through `validateAssetShape`, so the polygon rules and the incoherent-state
 * rules are asked in ONE place for every command rather than once per command.
 */
export type ShapeChange = (
	current: AssetShape | null,
	calibrated: boolean,
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
 * **What the existence check does NOT buy, stated where it is made.** It is asked here, in
 * the application layer; the sidecar's own exclusive region is `KeyedQueues`, inside
 * `AssetGeometryStore` and keyed per asset, entered only at `read` and `write`. So this write
 * is atomic with respect to other SIDECAR writes and not with respect to the asset's
 * EXISTENCE: an asset deleted between this `getById` and the write below leaves a sidecar
 * behind, because the delete's own `alsoRemove` found no file to remove and the first write's
 * condition — an absent file at revision zero — is satisfied by an absent file for a reason
 * that has nothing to do with the note. Closing it means the port growing an exclusive region
 * a caller can hold across a read and a write, with `ObsidianAssetRepository.delete` holding
 * the SAME one across both of its file operations, the note trash included. Recorded in
 * `docs/superpowers/plans/2026-08-30-asset-designer-first-increment.md` rather than only here.
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
export async function loadAssetDocument(
	deps: AssetShapeDeps,
	assetId: AssetId,
): Promise<Result<AssetGeometrySnapshot, RepositoryError | ReferenceError>> {
	const loaded = await deps.assets.getById(assetId);
	if (isErr(loaded)) return loaded;
	if (loaded.value === null) return err(assetNotFound(assetId));
	return deps.sidecar.read(assetId);
}

export async function updateAssetShape(
	deps: AssetShapeDeps,
	input: AssetShapeInput,
	change: ShapeChange,
	unchanged: ShapeUnchanged,
): Promise<VersionedDispatchResult> {
	const { sidecar, events } = deps;
	const snapshot = await loadAssetDocument(deps, input.assetId);
	if (isErr(snapshot)) return snapshot;
	const { document, version } = snapshot.value;

	const candidate = change(document.shape, document.calibration !== null);
	if (isErr(candidate)) return candidate;
	const shape = validateAssetShape(candidate.value);
	if (isErr(shape)) return shape;

	if (document.shape !== null && unchanged(document.shape, shape.value)) {
		return ok({ outcome: 'no-write' });
	}

	const next: AssetGeometryDocument = { ...document, shape: shape.value };
	const written = await sidecar.write(input.assetId, next, input.expected ?? version);
	if (isErr(written)) return written;
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
