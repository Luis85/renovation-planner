import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { err, isErr, ok, type Result } from '../../../core/result/Result';
import type { AssetId } from '../../../domain/asset/AssetId';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import type { Requirement } from '../../../domain/requirement/Requirement';
import type { RequirementId } from '../../../domain/requirement/RequirementId';
import type { RequirementListing, RequirementRepository } from '../../../application/ports/RequirementRepository';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import {
	cacheReading,
	fileStatAt,
	persistenceError,
	writeOwnedFrontmatter,
} from '../repositories/noteIo';
import { projectFolderOf, requirementsFolderFor } from '../repositories/paths';
import { KeyedQueues } from '../repositories/KeyedQueues';
import { fileAt } from '../repositories/NoteVaultDeps';
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
 * SEQUENCE lives once in `noteEntityWrite`. `saveQueued` resolves the owning project's
 * folder for itself, per save (ADR-0013, `projectFolderOf`) — never a constructor field,
 * since a project's folder can move between one save and the next — and hands it to the
 * spec, where only the INSERT path reads it. `markStale` resolves no folder at all: it
 * never inserts, so it has no location to choose, and it writes to the note the index
 * already resolved for its own read.
 */
export class ObsidianRequirementRepository implements RequirementRepository {
	private readonly queues = new KeyedQueues();

	constructor(private readonly deps: NoteVaultDeps) {}

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
		// Resolved here and consumed only on the INSERT path — `undefined` travels into the
		// spec rather than refusing outright, because an UPDATE writes where the note
		// already is and needs no folder at all (see `NoteWriteSpec.notesFolder`).
		const folder = projectFolderOf(this.deps.index, requirement.projectId);
		const spec: NoteWriteSpec<Requirement> = {
			kind: 'requirement',
			indexType: 'renovation-requirement',
			notesFolder: folder === undefined ? undefined : requirementsFolderFor(folder),
			projectId: (entity) => entity.projectId,
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
			trashNoteBackedEntity(this.deps, 'requirement', id, expected, { deleteFailedCode: 'requirement.delete-failed' }),
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

	/**
	 * Skip-and-count, not `listByZone`'s propagate-on-first-fault — see both docblocks in
	 * the port. `getIdsByProject` is a MIXED axis (plans and zones carry a `projectId` too),
	 * so the ids are intersected with the requirement TYPE before `listTolerantly` ever
	 * tries to read one, or a foreign kind's note would count as a refused requirement.
	 */
	listByProject(projectId: ProjectId): Promise<Result<RequirementListing, RepositoryError>> {
		const requirements = new Set<string>(
			this.deps.index.getIdsByType('renovation-requirement').map(String),
		);
		const ids = this.deps.index
			.getIdsByProject(projectId)
			.filter((id) => requirements.has(String(id))) as RequirementId[];
		return this.listTolerantly(ids);
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
			// The same lookup the read above went through, and no folder at all: `markStale`
			// never inserts, so it never chooses a location. It used to resolve the project's
			// folder and scan it — which refused for a note the user had filed anywhere else,
			// on a note this method had just read successfully through the index.
			const file = fileAt(this.deps.vault, this.deps.index.getPath(id));
			if (!file) {
				return err(
					persistenceError(
						'requirement.mark-stale-failed',
						`The requirement note for ${id} disappeared before the stale marker could be written.`,
					),
				);
			}
			// BEFORE the write: what the cache shows now. The stat is taken AFTER it.
			const reading = cacheReading(this.deps, file);
			try {
				await writeOwnedFrontmatter(this.deps.fileManager, file, dto);
			} catch (cause) {
				return err(persistenceError('requirement.mark-stale-failed', 'Writing the stale marker failed.', cause));
			}
			// `markStale` writes without bumping the revision, so the pre-write reading is the
			// only thing that can tell a lagging cache from a caught-up one here.
			this.deps.echo.markFrontmatter(file.path, dto, { reading, stat: fileStatAt(this.deps.vault, file.path) });
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

	/**
	 * `listByZone`'s opposite: every id is read, and a read that fails is SKIPPED and
	 * COUNTED rather than returned. Requirement notes carry no shared document the way a
	 * zone's geometry sidecar does — every failure `getById` can produce here is already
	 * note-local (a note-id mismatch, a malformed or unsupported schema version, a
	 * frontmatter the mapper refuses) — so there is no shared-failure case to propagate and
	 * nothing to filter by code, unlike the zone listings' skippable sets.
	 */
	private async listTolerantly(
		ids: readonly RequirementId[],
	): Promise<Result<RequirementListing, RepositoryError>> {
		const loaded: Loaded<Requirement>[] = [];
		let refused = 0;
		for (const id of ids) {
			const found = await this.getById(id);
			if (isErr(found)) {
				refused += 1;
				continue;
			}
			if (found.value !== null) loaded.push(found.value);
		}
		return ok({ loaded, refused });
	}
}
