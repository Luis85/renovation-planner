import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { RequirementRepository } from '../../../application/ports/RequirementRepository';
import {
	revisionConflict,
	type EntityVersion,
	type Expected,
	type Loaded,
} from '../../../application/ports/versioning';
import {
	ensureFolder,
	findNoteIdInFolder,
	frontmatterOf,
	openNoteById,
	persistenceError,
	serializeFrontmatter,
	writeOwnedFrontmatter,
} from '../repositories/noteIo';
import { checkExpectedVersion, versionOfFrontmatter } from '../repositories/versionCheck';
import { observeFrontmatter } from '../repositories/digest';
import { freshNotePath, normalizeFolder, requirementsFolderFor } from '../repositories/paths';
import { KeyedQueues } from '../repositories/KeyedQueues';
import type { NoteVaultDeps } from '../repositories/NoteVaultDeps';
import {
	requirementFromPersistence,
	requirementToPersistence,
} from '../../persistence/mappers/requirementMapper';

function validationFailure(message: string): ValidationError {
	return { category: 'Validation', code: 'requirement.pre-write-invalid', message };
}

/** Filename is never identity (�83); the id alone keeps requirement notes findable and unambiguous. */
function requirementFileName(requirement: Requirement): string {
	return `${requirement.id}`;
}
/**
 * The note-backed half of the conditional-write contract, without a sidecar — a
 * requirement references its Zone by ID and stores no geometry (§3.6). `markStale` is the
 * one method no other repository has: it sets ONE field in ONE direction, inside the same
 * per-entity queue section as every other write, so its read-modify-write cannot
 * interleave with a concurrent override or recalculation.
 */
export class ObsidianRequirementRepository implements RequirementRepository {
	private readonly queues = new KeyedQueues();
	private readonly folder: string;

	constructor(private readonly deps: NoteVaultDeps) {
		this.folder = normalizeFolder(deps.projectFolder);
	}

	getById(id: RequirementId): Promise<Result<Loaded<Requirement> | null, PersistenceError>> {
		const opened = openNoteById(this.deps, 'requirement', id);
		if (opened.status === 'missing') return Promise.resolve(ok(null));
		if (opened.status === 'error') return Promise.resolve(err(opened.error));
		const entity = requirementFromPersistence(opened.migrated);
		if (!entity.ok) {
			return Promise.resolve(
				err(persistenceError('requirement.entity-invalid', entity.error.message)),
			);
		}
		return Promise.resolve(ok({ entity: entity.value, version: versionOfFrontmatter(opened.raw) }));
	}

	save(
		requirement: Requirement,
		expected: Expected,
	): Promise<Result<Loaded<Requirement>, PersistenceError | ValidationError>> {
		return this.queues.run(`requirement:${requirement.id}`, () =>
			this.saveQueued(requirement, expected),
		);
	}

	private async saveQueued(
		requirement: Requirement,
		expected: Expected,
	): Promise<Result<Loaded<Requirement>, PersistenceError | ValidationError>> {
		const notesFolder = requirementsFolderFor(this.folder);
		const existing = findNoteIdInFolder(this.deps, this.deps.vault, notesFolder, requirement.id);
		const currentVersion = existing
			? versionOfFrontmatter(frontmatterOf(this.deps, existing))
			: undefined;

		const conflict = checkExpectedVersion('requirement', requirement.id, currentVersion, expected);
		if (conflict) return err(conflict);

		const nextRevision = (currentVersion?.revision ?? 0) + 1;
		const dto = requirementToPersistence(requirement, nextRevision);
		if (!requirementFromPersistence({ ...dto }).ok) {
			return err(validationFailure('The requirement failed pre-write validation.'));
		}

		let notePath: string;
		try {
			if (existing) {
				notePath = existing.path;
				await writeOwnedFrontmatter(this.deps.fileManager, existing, dto);
			} else {
				await ensureFolder(this.deps.vault, notesFolder);
				notePath = freshNotePath(
					this.deps.vault,
					notesFolder,
					requirementFileName(requirement),
					requirement.id,
				);
				await this.deps.vault.create(notePath, serializeFrontmatter(dto));
			}
		} catch (cause) {
			return err(
				persistenceError(
					'requirement.write-failed',
					`Could not write requirement ${requirement.id}.`,
					cause,
				),
			);
		}

		this.deps.index.upsert({
			id: requirement.id,
			type: 'renovation-requirement',
			path: notePath,
			projectId: requirement.projectId,
		});
		this.deps.echo.markFrontmatter(notePath, dto);
		return ok({
			entity: requirement,
			version: { revision: nextRevision, observed: observeFrontmatter(dto) },
		});
	}

	delete(id: RequirementId, expected: EntityVersion): Promise<Result<void, PersistenceError | ValidationError>> {
		return this.queues.run(`requirement:${id}`, async () => {
			const opened = openNoteById(this.deps, 'requirement', id);
			if (opened.status === 'missing') {
				return err(revisionConflict('requirement', id));
			}
			if (opened.status === 'error') return err(opened.error);
			const conflict = checkExpectedVersion('requirement', id, versionOfFrontmatter(opened.raw), expected);
			if (conflict) return err(conflict);
			try {
				await this.deps.fileManager.trashFile(opened.file);
			} catch (cause) {
				return err(persistenceError('requirement.delete-failed', `Could not delete requirement ${id}.`, cause));
			}
			this.deps.index.remove(id);
			return ok(undefined);
		});
	}

	listByZone(zoneId: ZoneId): Promise<Result<Loaded<Requirement>[], PersistenceError>> {
		const ids = this.deps.index.getIdsByType('renovation-requirement') as RequirementId[];
		return this.filterLoaded(ids, (r) => r.origin.kind === 'zone' && r.origin.zoneId === zoneId);
	}

	listByAsset(assetId: AssetId): Promise<Result<Loaded<Requirement>[], PersistenceError>> {
		const ids = this.deps.index.getIdsByType('renovation-requirement') as RequirementId[];
		return this.filterLoaded(ids, (r) => r.assetId === assetId);
	}

	markStale(id: RequirementId): Promise<Result<void, PersistenceError>> {
		return this.queues.run(`requirement:${id}`, async () => {
			const loaded = await this.getById(id);
			if (isErr(loaded)) return err(loaded.error);
			if (loaded.value === null) {
				return err(
					persistenceError(
						'requirement.not-found',
						`Requirement ${id} could not be marked stale because it does not exist.`,
					),
				);
			}
			const marked = loaded.value.entity.markedStale();
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
	): Promise<Result<Loaded<Requirement>[], PersistenceError>> {
		const loaded: Loaded<Requirement>[] = [];
		for (const id of ids) {
			const found = await this.getById(id);
			if (isErr(found)) return found;
			if (found.value !== null && predicate(found.value.entity)) loaded.push(found.value);
		}
		return ok(loaded);
	}
}

