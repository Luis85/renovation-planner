import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import { isErr, ok, err, type Result } from '../../../core/result/Result';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { Asset } from '../../../domain/asset/Asset';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { AssetRepository } from '../../../application/ports/AssetRepository';
import { revisionConflict, type EntityVersion, type Expected, type Loaded } from '../../../application/ports/versioning';
import {
	ensureFolder,
	findNoteIdInFolder,
	frontmatterOf,
	openNoteById,
	persistenceError,
	serializeFrontmatter,
	writeOwnedFrontmatter,
} from '../repositories/noteIo';
import {
	checkExpectedVersion,
	versionOfFrontmatter,
} from '../repositories/versionCheck';
import { observeFrontmatter } from '../repositories/digest';
import { assetsFolderFor, freshNotePath, normalizeFolder } from '../repositories/paths';
import { KeyedQueues } from '../repositories/KeyedQueues';
import type { NoteVaultDeps } from '../repositories/NoteVaultDeps';
import { assetFromPersistence, assetToPersistence } from '../../persistence/mappers/assetMapper';

function validationFailure(message: string): ValidationError {
	return { category: 'Validation', code: 'asset.pre-write-invalid', message };
}

/**
 * The Zone repository's six-step save contract, without the geometry sidecar — an asset
 * note owns no second file, so steps 4/5 collapse away and what remains is the plain
 * conditional note write: validate fully before any I/O, snapshot, compare-and-swap,
 * write, sync index upsert + echo.
 */
export class ObsidianAssetRepository implements AssetRepository {
	private readonly queues = new KeyedQueues();
	private readonly folder: string;

	constructor(private readonly deps: NoteVaultDeps) {
		this.folder = normalizeFolder(deps.projectFolder);
	}

	getById(id: AssetId): Promise<Result<Loaded<Asset> | null, PersistenceError>> {
		const opened = openNoteById(this.deps, 'asset', id);
		if (opened.status === 'missing') return Promise.resolve(ok(null));
		if (opened.status === 'error') return Promise.resolve(err(opened.error));

		const entity = assetFromPersistence(opened.migrated);
		if (!entity.ok) {
			return Promise.resolve(err(persistenceError('asset.entity-invalid', entity.error.message)));
		}
		return Promise.resolve(ok({ entity: entity.value, version: versionOfFrontmatter(opened.raw) }));
	}

	save(
		asset: Asset,
		expected: Expected,
	): Promise<Result<Loaded<Asset>, PersistenceError | ValidationError>> {
		return this.queues.run(`asset:${asset.id}`, () => this.saveQueued(asset, expected));
	}

	private async saveQueued(
		asset: Asset,
		expected: Expected,
	): Promise<Result<Loaded<Asset>, PersistenceError | ValidationError>> {
		const notesFolder = assetsFolderFor(this.folder);
		const existing = findNoteIdInFolder(this.deps, this.deps.vault, notesFolder, asset.id);
		const currentVersion = existing
			? versionOfFrontmatter(frontmatterOf(this.deps, existing))
			: undefined;

		const conflict = checkExpectedVersion('asset', asset.id, currentVersion, expected);
		if (conflict) return err(conflict);

		const nextRevision = (currentVersion?.revision ?? 0) + 1;
		const dto = assetToPersistence(asset, nextRevision);
		if (!this.preWriteValid(dto)) {
			return err(validationFailure('The asset failed pre-write validation.'));
		}

		let notePath: string;
		try {
			if (existing) {
				notePath = existing.path;
				await writeOwnedFrontmatter(this.deps.fileManager, existing, dto);
			} else {
				await ensureFolder(this.deps.vault, notesFolder);
				notePath = freshNotePath(this.deps.vault, notesFolder, asset.name, asset.id);
				await this.deps.vault.create(notePath, serializeFrontmatter(dto));
			}
		} catch (cause) {
			return err(persistenceError('asset.write-failed', `Could not write asset ${asset.id}.`, cause));
		}

		this.deps.index.upsert({
			id: asset.id,
			type: 'renovation-asset',
			path: notePath,
			projectId: asset.projectId,
		});
		this.deps.echo.markFrontmatter(notePath, dto);
		return ok({
			entity: asset,
			version: { revision: nextRevision, observed: observeFrontmatter(dto) },
		});
	}

	delete(id: AssetId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>> {
		return this.queues.run(`asset:${id}`, async () => {
			const opened = openNoteById(this.deps, 'asset', id);
			if (opened.status === 'missing') {
				// A missing note fails the conditional delete the same way a stale
				// revision does: what this caller read is no longer there.
				return err(revisionConflict('asset', id));
			}
			if (opened.status === 'error') return err(opened.error);
			const conflict = checkExpectedVersion('asset', id, versionOfFrontmatter(opened.raw), expected);
			if (conflict) return err(conflict);
			try {
				await this.deps.fileManager.trashFile(opened.file);
			} catch (cause) {
				return err(persistenceError('asset.delete-failed', `Could not delete asset ${id}.`, cause));
			}
			this.deps.index.remove(id);
			return ok(undefined);
		});
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

	private preWriteValid(dto: Record<string, unknown>): boolean {
		// The same schema the read path parses with proves the write BEFORE any disk touch.
		return assetFromPersistence({ ...dto }).ok;
	}
}
