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
 * The Zone repository's six-step save contract, without the geometry sidecar — an asset
 * note owns no second file. The write SEQUENCE lives once in `noteEntityWrite`; this
 * class keeps the per-kind facts: its mapper and its error codes.
 *
 * Its folder is the LIBRARY's since design slice 19 — the catalogue belongs to the vault
 * rather than to a project, so there is no project note to derive a folder from and the
 * configured setting is the whole answer. That is a constructor field rather than a
 * per-save resolution for the reason the opposite was true before it: the setting is read
 * at composition and a change to it rebuilds the root, while a PROJECT's folder could move
 * under a live repository.
 */
export class ObsidianAssetRepository implements AssetRepository {
	private readonly queues = new KeyedQueues();

	constructor(
		private readonly deps: NoteVaultDeps,
		private readonly libraryFolder: string,
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

	delete(id: AssetId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`asset:${id}`, () =>
			trashNoteBackedEntity(this.deps, 'asset', id, 'asset.delete-failed', expected),
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

	private async list(ids: readonly AssetId[]): Promise<Result<Loaded<Asset>[], RepositoryError>> {
		const loaded: Loaded<Asset>[] = [];
		for (const id of ids) {
			const found = await this.getById(id);
			if (isErr(found)) return found;
			if (found.value !== null) loaded.push(found.value);
		}
		return ok(loaded);
	}
}
