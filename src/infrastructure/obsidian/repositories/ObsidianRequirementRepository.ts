import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { RequirementRepository } from '../../../application/ports/RequirementRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import {
	findNoteIdInFolder,
	persistenceError,
	writeOwnedFrontmatter,
} from '../repositories/noteIo';
import { normalizeFolder, requirementsFolderFor } from '../repositories/paths';
import { KeyedQueues } from '../repositories/KeyedQueues';
import type { NoteVaultDeps } from '../repositories/NoteVaultDeps';
import {
	requirementFromPersistence,
	requirementToPersistence,
} from '../../persistence/mappers/requirementMapper';
import {
	readNoteBackedEntity,
	saveNoteBackedEntity,
	trashNoteBackedEntity,
	type NoteWriteSpec,
} from './noteEntityWrite';

/** Filename is never identity (§83); the id alone keeps requirement notes findable and unambiguous. */
function requirementFileName(requirement: Requirement): string {
	return `${requirement.id}`;
}

/**
 * The note-backed half of the conditional-write contract, without a sidecar — a
 * requirement references its Zone by ID and stores no geometry (§3.6). `markStale` is the
 * one method no other repository has: it sets ONE field in ONE direction, inside the same
 * per-entity queue section as every other write, so its read-modify-write cannot
 * interleave with a concurrent override or recalculation. The shared save/delete
 * SEQUENCE lives once in `noteEntityWrite`.
 */
export class ObsidianRequirementRepository implements RequirementRepository {
	private readonly queues = new KeyedQueues();
	private readonly folder: string;

	constructor(private readonly deps: NoteVaultDeps) {
		this.folder = normalizeFolder(deps.projectFolder);
	}

	getById(id: RequirementId): Promise<Result<Loaded<Requirement> | null, RepositoryError>> {
		return readNoteBackedEntity(
			this.deps,
			'requirement',
			id,
			requirementFromPersistence,
			'requirement.entity-invalid',
		);
	}

	save(
		requirement: Requirement,
		expected: Expected,
	): Promise<Result<Loaded<Requirement>, RepositoryError>> {
		return this.queues.run(`requirement:${requirement.id}`, () =>
			this.saveQueued(requirement, expected),
		);
	}

	private saveQueued(
		requirement: Requirement,
		expected: Expected,
	): Promise<Result<Loaded<Requirement>, RepositoryError>> {
		const spec: NoteWriteSpec<Requirement> = {
			kind: 'requirement',
			indexType: 'renovation-requirement',
			notesFolder: requirementsFolderFor(this.folder),
			entryName: requirementFileName,
			toPersistence: requirementToPersistence,
			preWriteValid: (dto) => requirementFromPersistence({ ...dto }).ok,
			validationCode: 'requirement.pre-write-invalid',
			writeFailedCode: 'requirement.write-failed',
		};
		return saveNoteBackedEntity(this.deps, spec, requirement, expected);
	}

	delete(id: RequirementId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`requirement:${id}`, () =>
			trashNoteBackedEntity(this.deps, 'requirement', id, 'requirement.delete-failed', expected),
		);
	}

	listByZone(zoneId: ZoneId): Promise<Result<Loaded<Requirement>[], RepositoryError>> {
		const ids = this.deps.index.getIdsByType('renovation-requirement') as RequirementId[];
		return this.filterLoaded(ids, (r) => r.origin.kind === 'zone' && r.origin.zoneId === zoneId);
	}

	listByAsset(assetId: AssetId): Promise<Result<Loaded<Requirement>[], RepositoryError>> {
		const ids = this.deps.index.getIdsByType('renovation-requirement') as RequirementId[];
		return this.filterLoaded(ids, (r) => r.assetId === assetId);
	}

	markStale(id: RequirementId): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`requirement:${id}`, async () => {
			const loaded: Result<Loaded<Requirement> | null, RepositoryError> = await this.getById(id);
			if (isErr(loaded)) return err(loaded.error);
			if (loaded.value === null) {
				return err(
					persistenceError(
						'requirement.not-found',
						`Requirement ${id} could not be marked stale because it does not exist.`,
					),
				);
			}
			const entity: Requirement = loaded.value.entity;
			const marked = entity.markedStale();
			if (!marked.ok) {
				return err(persistenceError('requirement.mark-stale-invalid', marked.error.message));
			}
			const dto = requirementToPersistence(marked.value, loaded.value.version.revision);
			const file = findNoteIdInFolder(
				this.deps,
				this.deps.vault,
				requirementsFolderFor(this.folder),
				id,
			);
			if (!file) {
				return err(
					persistenceError(
						'requirement.mark-stale-failed',
						`The requirement note for ${id} disappeared before the stale marker could be written.`,
					),
				);
			}
			try {
				await writeOwnedFrontmatter(this.deps.fileManager, file, dto);
			} catch (cause) {
				return err(persistenceError('requirement.mark-stale-failed', 'Writing the stale marker failed.', cause));
			}
			this.deps.echo.markFrontmatter(file.path, dto);
			return ok(undefined);
		});
	}

	private async filterLoaded(
		ids: readonly RequirementId[],
		predicate: (r: Requirement) => boolean,
	): Promise<Result<Loaded<Requirement>[], RepositoryError>> {
		const loaded: Loaded<Requirement>[] = [];
		for (const id of ids) {
			const found = await this.getById(id);
			if (isErr(found)) return found;
			if (found.value !== null && predicate(found.value.entity)) loaded.push(found.value);
		}
		return ok(loaded);
	}
}
