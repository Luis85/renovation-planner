import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { Asset } from '../../../domain/asset/Asset';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetRepository } from '../../../application/ports/AssetRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import { assetsFolderFor, projectFolderOf } from '../repositories/paths';
import { persistenceError } from '../repositories/noteIo';
import { KeyedQueues } from '../repositories/KeyedQueues';
import type { NoteVaultDeps } from '../repositories/NoteVaultDeps';
import { assetFromPersistence, assetToPersistence } from '../../persistence/mappers/assetMapper';
import {
	readNoteBackedEntity,
	saveNoteBackedEntity,
	trashNoteBackedEntity,
	type NoteWriteSpec,
} from './noteEntityWrite';

const SPEC: NoteWriteSpec<Asset> = {
	kind: 'asset',
	indexType: 'renovation-asset',
	notesFolder: '',
	entryName: (asset) => asset.name,
	toPersistence: assetToPersistence,
	preWriteValid: (dto) => assetFromPersistence({ ...dto }).ok,
	validationCode: 'asset.pre-write-invalid',
	writeFailedCode: 'asset.write-failed',
};

/**
 * The Zone repository's six-step save contract, without the geometry sidecar — an asset
 * note owns no second file. The write SEQUENCE lives once in `noteEntityWrite`; this
 * class keeps the per-kind facts: its mapper and its error codes. Its folder is resolved
 * per save, from the owning project's own note (ADR-0013, `projectFolderOf`) — never a
 * constructor field, since a project's folder can move (a rename, a manual reorganisation)
 * between one save and the next.
 */
export class ObsidianAssetRepository implements AssetRepository {
	private readonly queues = new KeyedQueues();

	constructor(private readonly deps: NoteVaultDeps) {}

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
		const folder = projectFolderOf(this.deps.index, asset.projectId);
		if (folder === undefined) {
			return Promise.resolve(
				err(persistenceError('asset.project-folder-unresolved', `Could not resolve the folder of project ${asset.projectId} for asset ${asset.id}.`)),
			);
		}
		const spec: NoteWriteSpec<Asset> = { ...SPEC, notesFolder: assetsFolderFor(folder) };
		return saveNoteBackedEntity(this.deps, spec, asset, expected);
	}

	delete(id: AssetId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`asset:${id}`, () =>
			trashNoteBackedEntity(this.deps, 'asset', id, 'asset.delete-failed', expected),
		);
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<Asset>[], RepositoryError>> {
		const ids = this.deps.index
			.getIdsByProject(projectId)
			.filter((id) => String(id).startsWith('asset-')) as AssetId[];
		return this.list(ids);
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
