import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ReferenceError, ValidationError } from '../../../core/errors/AppError';
import type { RepositoryError } from '../../ports/repositoryErrors';
import { Asset } from '../../../domain/asset/Asset';
import { createAssetId, type AssetId } from '../../../domain/asset/AssetId';
import { assetCreated } from '../../../domain/asset/Asset.events';
import { assetNotFound } from '../../../domain/asset/Asset.errors';
import type { AssetGeometryDocument } from '../../ports/AssetGeometrySidecar';
import type { EntityVersion } from '../../ports/versioning';
import type { Command } from '../Command';
import { markUncompensated } from '../DispatchOutcome';
import { loadAssetEntity, type AssetShapeDeps } from './updateAssetShape';

/**
 * What one `Duplicate as new asset` gesture supplies (AD13 item 4, C11).
 *
 * `name` is REQUIRED and carries no default, because the only sensible default is
 * user-visible text — *"{name} (copy)"* — and text belongs in the locale tables, one layer up.
 * A command minting its own display string would put English in `application/`, and a German
 * vault would get an English suffix persisted into it forever.
 */
export interface DuplicateAssetInput {
	readonly assetId: AssetId;
	readonly name: string;
}

export type DuplicateAssetErrors = RepositoryError | ReferenceError | ValidationError;

/**
 * Copy one catalogue definition — its metadata AND its geometry — to a NEW asset identity
 * (AD13 item 4, C11's *"provide Duplicate as new asset for intentional divergence"*).
 *
 * **What is remapped: the asset id, and nothing else.** C06 asks that a duplicate *"assigns
 * fresh IDs once and remaps group membership consistently"*, and that sentence is about
 * duplicating a PART inside one shape — which `detailEdits.duplicateDetail` already does
 * through `nextDetailId`. A whole-asset duplicate is a different operation with a different
 * scope: `detail-<n>` and `group-<n>` are numbered WITHIN one `AssetShape`
 * (`nextDetailId`/`nextGroupId` count off that shape's own ids and nothing else), the copy is
 * its own document, and nothing outside that document names a part id — a `NamedSpatialElement`
 * carries an `assetId`, a `Requirement` carries an `assetId`, and neither carries a
 * `detail-<n>`. So the shape is copied VERBATIM, which is also what preserves what C09 asks a
 * migration to preserve: identities, order, bulges, pending flags, measured coordinates and
 * every placement attribute. Remapping here would renumber a correct identity graph for
 * nothing and lose the one property a copy is supposed to have.
 *
 * **It is two resources and therefore a staged write (C08).** `CreateAssetInput` carries no
 * geometry at all, so there is no single-resource spelling of this: the note holds the
 * metadata and the `.rpgeo` holds the shape.
 *
 * **The NOTE is written first, and that order is not a preference.** `updateAssetShape`'s own
 * docblock records what the other order costs: a `.rpgeo` written for an id with no note is the
 * orphan *"a reused id later attaches to, defeating the store's `asset-id-mismatch` guard"*. A
 * note written with no sidecar is the ordinary state of an undesigned asset and needs no
 * recovery at all.
 *
 * **Compensation is a DELETE of the note this command just created, conditioned on the version
 * this command's own `save` produced.** That version is what makes the cleanup satisfy C08's
 * *"must verify that it only touches files created by that operation and has not overwritten
 * later user edits"*: the id was minted here so no other note can carry it, and an edit landing
 * in between moves the version, at which point the delete REFUSES and the note stays. No path
 * here deletes a file by name or by guess.
 *
 * **A failed compensation is reported, not swallowed** — `markUncompensated`, the rule
 * `SetAssetBackgroundCommand` states for its own two-write gesture. The vault then really does
 * hold a metadata-only copy of the definition, which is a recoverable state a user can see in
 * the catalogue and delete; answering the sidecar's refusal unstamped would leave them looking
 * at a row nobody told them about.
 *
 * **It publishes `AssetCreated` and nothing else, and the omission is the point.** The
 * catalogue is what changed; `createAssetLibraryChangeSource` maps that event to
 * `catalogue: true` with `marks`, `design` and `usage` all empty, which is correct because the
 * new id has no cached mark and no cached design to invalidate. Nothing at all is published
 * for the SOURCE asset — AD13 criterion 3's *"a duplicate does not change the original"* is
 * true of the vault here and has to stay true of every surface watching it, and an
 * `AssetUpdated` for the source would restart the recalculation cascade over requirements no
 * price edit touched.
 */
export class DuplicateAssetCommand
	implements Command<DuplicateAssetInput, Result<Asset, DuplicateAssetErrors>>
{
	constructor(private readonly deps: AssetShapeDeps) {}

	/**
	 * The whole gesture under ONE exclusive region on the SOURCE id.
	 *
	 * The region is about the READ rather than the writes: the copy's own id was minted in this
	 * call and nothing else in the session can be holding it, while the source's note and
	 * sidecar are two reads a peer leaf's design command can land between — which would compose
	 * the copy out of one moment's metadata and another moment's geometry.
	 */
	execute(input: DuplicateAssetInput): Promise<Result<Asset, DuplicateAssetErrors>> {
		return this.deps.locks.withLevel1(input.assetId, () => this.copy(input));
	}

	private async copy(input: DuplicateAssetInput): Promise<Result<Asset, DuplicateAssetErrors>> {
		const { assets, sidecar, events } = this.deps;

		// A failed READ is not "asset missing" (C08); `loadAssetEntity` is the one place that
		// distinction is made, for the three other commands that used to spell it here too.
		const loaded = await loadAssetEntity(assets, input.assetId);
		if (isErr(loaded)) return loaded;

		// Read BEFORE the first write, so a damaged source sidecar refuses with nothing written
		// at all rather than leaving a metadata-only copy to compensate away.
		const snapshot = await sidecar.read(input.assetId);
		if (isErr(snapshot)) return snapshot;

		// Re-validated through `Asset.create` rather than cloned, for `CreateAssetCommand`'s
		// reason: the source note is a file a user can hand-edit, so a value that would be
		// refused for a new asset is refused for a copy of an old one too.
		const candidate = Asset.create({ ...loaded.value.entity, id: createAssetId(), name: input.name });
		if (isErr(candidate)) return candidate;

		const saved = await assets.save(candidate.value, 'absent');
		if (isErr(saved)) return saved;
		const copy = saved.value.entity;

		const geometry = await this.copyGeometry(copy.id, snapshot.value.document, saved.value.version);
		if (isErr(geometry)) return geometry;

		await events.publish(assetCreated({ assetId: copy.id }));
		return ok(copy);
	}

	/**
	 * The second resource, plus its compensation.
	 *
	 * **A source with no geometry writes no sidecar**, rather than writing an empty one: an
	 * absent `.rpgeo` and one holding `{ calibration: null, shape: null }` are the identical
	 * answer to every reader (`ListAssetOutlines` says so), so the empty write would create a
	 * file that means nothing and hand this gesture a failure mode it need not have.
	 */
	private async copyGeometry(
		assetId: AssetId,
		document: AssetGeometryDocument,
		noteVersion: EntityVersion,
	): Promise<Result<void, DuplicateAssetErrors>> {
		const { assets, sidecar } = this.deps;
		if (document.shape === null && document.calibration === null) return ok(undefined);

		const written = await sidecar.write(assetId, document);
		if (!isErr(written)) return ok(undefined);

		const removed = await assets.delete(assetId, noteVersion);
		return err(isErr(removed) ? markUncompensated(written.error) : written.error);
	}
}
