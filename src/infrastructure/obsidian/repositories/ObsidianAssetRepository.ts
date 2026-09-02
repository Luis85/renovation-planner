import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { isErr, ok, type Result } from '../../../core/result/Result';
import type { Asset } from '../../../domain/asset/Asset';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetRepository } from '../../../application/ports/AssetRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import { assetsFolderFor, normalizeFolder } from '../repositories/paths';
import { KeyedQueues } from '../repositories/KeyedQueues';
import type { NoteVaultDeps } from '../repositories/NoteVaultDeps';
import { assetFromPersistence, assetToPersistence } from '../../persistence/mappers/assetMapper';
import {
	readNoteBackedEntity,
	saveNoteBackedEntity,
	trashNoteBackedEntity,
	type NoteWriteSpec,
} from './noteEntityWrite';
import type { AssetGeometryStore } from './AssetGeometryStore';

/**
 * Everything about an asset write that is a fact about the KIND. The folder is left out
 * because it is a fact about the INSTANCE — the library folder this repository was
 * composed with — rather than because it varies from one save to the next; it no longer
 * does, now that it is no longer derived from a project note.
 */
const SPEC: Omit<NoteWriteSpec<Asset>, 'notesFolder'> = {
	kind: 'asset',
	indexType: 'renovation-asset',
	// A catalogue entry belongs to no project, so its index entry carries none — which is
	// what keeps assets off `getIdsByProject` BY CONSTRUCTION rather than by a filter.
	projectId: () => undefined,
	// `project` was an owned key through design slice 18. Omitting it from the DTO cannot
	// clear it, because the write is a merge; see `writeOwnedFrontmatter`.
	retiredKeys: ['project'],
	entryName: (asset) => asset.name,
	toPersistence: assetToPersistence,
	preWriteValid: (dto) => assetFromPersistence({ ...dto }).ok,
	validationCode: 'asset.pre-write-invalid',
	writeFailedCode: 'asset.write-failed',
};

/**
 * The Zone repository's six-step SAVE contract, without the geometry sidecar. The write
 * SEQUENCE lives once in `noteEntityWrite`; this class keeps the per-kind facts: its
 * mapper and its error codes.
 *
 * Its folder is the LIBRARY's since design slice 19 — the catalogue belongs to the vault
 * rather than to a project, so there is no project note to derive a folder from and the
 * configured setting is the whole answer. That is a constructor field rather than a
 * per-save resolution for the reason the opposite was true before it: the setting is read
 * at composition and a change to it rebuilds the root, while a PROJECT's folder could move
 * under a live repository.
 *
 * **A save owns one file and a DELETE owns two.** An asset's geometry lives in a sidecar (ADR-0014)
 * that no save of this repository ever touches — the design commands write it through
 * `AssetGeometrySidecar`, and its absence is the ordinary state of an undesigned asset — so
 * the SAVE contract is unchanged and only the delete takes the store. Deleting the note
 * alone left `<libraryFolder>/Geometry/<assetId>.rpgeo` behind: inert-looking, carried to
 * the new folder by every later library migration, and — since an asset id is a
 * user-editable frontmatter field — loaded onto a REUSED id, which is the one case
 * `AssetGeometryStore`'s `asset-id-mismatch` guard cannot refuse, because a reused id makes
 * the file and the request agree.
 */
export class ObsidianAssetRepository implements AssetRepository {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly deps: NoteVaultDeps,
		private readonly libraryFolder: string,
		private readonly geometry: AssetGeometryStore,
	) {}

	getById(id: AssetId): Promise<Result<Loaded<Asset> | null, RepositoryError>> {
		return readNoteBackedEntity(this.deps, 'asset', id, assetFromPersistence, 'asset.entity-invalid');
	}

	save(
		asset: Asset,
		expected: Expected,
	): Promise<Result<Loaded<Asset>, RepositoryError>> {
		return this.queues.run(`asset:${asset.id}`, () => this.saveQueued(asset, expected));
	}

	private saveQueued(
		asset: Asset,
		expected: Expected,
	): Promise<Result<Loaded<Asset>, RepositoryError>> {
		const spec: NoteWriteSpec<Asset> = {
			...SPEC,
			notesFolder: assetsFolderFor(normalizeFolder(this.libraryFolder)),
		};
		return saveNoteBackedEntity(this.deps, spec, asset, expected);
	}

	/**
	 * The note and the geometry sidecar, in that order, with the note restored byte-for-byte
	 * if the sidecar refuses — `ObsidianPlanRepository.delete`'s contract, reached through
	 * the shared note-delete sequence rather than by a second copy of it. `NoteDeleteSpec`
	 * carries why the order is this way round.
	 */
	delete(id: AssetId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		// BEFORE anything is trashed, because the note's own delete event can take the index
		// entry out while `trashNoteBackedEntity` awaits the trash — and `alsoRemove` runs after
		// that await. Resolved here, a moved sidecar is deleted with its asset; resolved inside
		// the callback, the lookup misses, the derivation answers a path with no file at it, and
		// the asset goes leaving its geometry behind. The same capture, for the same reason, that
		// `PlanGeometryStore.delete`'s own call site makes.
		const sidecarPath = this.deps.index.getGeometrySidecarPath(id);
		return this.queues.run(`asset:${id}`, () =>
			trashNoteBackedEntity(this.deps, 'asset', id, expected, {
				deleteFailedCode: 'asset.delete-failed',
				alsoRemove: () => this.geometry.delete(id, sidecarPath),
			}),
		);
	}

	/**
	 * The whole vault's catalogue, over the TYPE axis — assets fall off the project axis by
	 * construction (nothing upserts them with a `projectId`), so this needs no filter and
	 * no exclusion list.
	 */
	listAll(): Promise<Result<Loaded<Asset>[], RepositoryError>> {
		return this.list(this.deps.index.getIdsByType('renovation-asset') as AssetId[]);
	}

	/**
	 * One unreadable note does not take the catalogue down with it.
	 *
	 * This used to return the first refusal, which was survivable while the list was
	 * per-project: a corrupt asset note disabled assignment in its OWN project. Since the
	 * catalogue became vault-wide it is not — one hand-edited note anywhere would empty the
	 * assign picker in EVERY project, and `loadAssetOptions` shows an empty list rather than
	 * an error, so the failure is silent as well as total.
	 *
	 * The refusal is RECORDED rather than dropped. `openNoteById` already writes a migration
	 * failure to the ledger, but the `fromPersistence` arm — invalid asset frontmatter on a
	 * note whose `type` and `id` are fine, which is exactly the reported case — returns its
	 * error without recording, so skipping silently would lose the signal entirely.
	 *
	 * The shape is `ObsidianProjectRepository.listAll`'s, minus its `refused` count: that
	 * exists because the project list must tell "no projects" from "projects I could not
	 * read", and the assign picker has no such distinction to draw.
	 */
	private async list(ids: readonly AssetId[]): Promise<Result<Loaded<Asset>[], RepositoryError>> {
		const loaded: Loaded<Asset>[] = [];
		for (const id of ids) {
			const found = await this.getById(id);
			if (isErr(found)) {
				this.deps.ledger.record('asset', id, found.error);
				continue;
			}
			if (found.value !== null) loaded.push(found.value);
		}
		return ok(loaded);
	}
}
