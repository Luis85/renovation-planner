import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import { isErr, ok, type Result } from '../../../core/result/Result';
import type { ProjectId } from '../../../domain/project/ProjectId';
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
 * class keeps the per-kind facts: its folder, its mapper and its error codes.
 */
export class ObsidianAssetRepository implements AssetRepository {
	private readonly queues = new KeyedQueues();
	private readonly folder: string;

	constructor(private readonly deps: NoteVaultDeps) {
		this.folder = normalizeFolder(deps.projectFolder);
	}

	getById(id: AssetId): Promise<Result<Loaded<Asset> | null, PersistenceError>> {
		return readNoteBackedEntity(this.deps, 'asset', id, assetFromPersistence, 'asset.entity-invalid');
	}

	save(
		asset: Asset,
		expected: Expected,
	): Promise<Result<Loaded<Asset>, PersistenceError | ValidationError>> {
		return this.queues.run(`asset:${asset.id}`, () => this.saveQueued(asset, expected));
	}

	private saveQueued(
		asset: Asset,
		expected: Expected,
	): Promise<Result<Loaded<Asset>, PersistenceError | ValidationError>> {
		const spec: NoteWriteSpec<Asset> = { ...SPEC, notesFolder: assetsFolderFor(this.folder) };
		return saveNoteBackedEntity(this.deps, spec, asset, expected);
	}

	delete(id: AssetId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>> {
		return this.queues.run(`asset:${id}`, () =>
			trashNoteBackedEntity(this.deps, 'asset', id, 'asset.delete-failed', expected),
		);
	}

	listByProject(projectId: ProjectId): Promise<Result<Loaded<Asset>[], PersistenceError>> {
		const ids = this.deps.index
			.getIdsByProject(projectId)
			.filter((id) => String(id).startsWith('asset-')) as AssetId[];
		return this.list(ids);
	}

	private async list(ids: readonly AssetId[]): Promise<Result<Loaded<Asset>[], PersistenceError>> {
		const loaded: Loaded<Asset>[] = [];
		for (const id of ids) {
			const found = await this.getById(id);
			if (isErr(found)) return found;
			if (found.value !== null) loaded.push(found.value);
		}
		return ok(loaded);
	}
}
