import type { TFile } from 'obsidian';
import { err, ok, type Result } from '../../../core/result/Result';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import type { Project } from '../../../domain/project/Project';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { EntityVersion, Expected, Loaded } from '../../../application/ports/versioning';
import type { ProjectListing } from '../../../application/ports/ProjectRepository';
import { revisionConflict } from '../../../application/ports/versioning';
import { projectFromPersistence, projectToPersistence } from '../../persistence/mappers/projectMapper';
import {
	ensureFolder,
	findNoteIdInFolder,
	frontmatterOf,
	migrateNote,
	persistenceError,
	serializeFrontmatter,
	writeOwnedFrontmatter,
} from './noteIo';
import { observeFrontmatter } from './digest';
import { checkExpectedVersion, versionOfFrontmatter } from './versionCheck';
import { freshNotePath, normalizeFolder } from './paths';
import { KeyedQueues } from './KeyedQueues';
import type { NoteVaultDeps } from './NoteVaultDeps';
import { fileAt } from './NoteVaultDeps';

/**
 * The Obsidian-backed ProjectRepository (SDD §36–38): one Markdown note per Project
 * inside the project folder; frontmatter is the whole persisted state. The simplest of
 * the three repositories — ONE file per entity — which is why its failure story needs
 * nothing beyond "the write failed, nothing was written".
 *
 * Raw frontmatter never leaves this class: reads migrate, schema-parse and map before
 * returning; writes lower the entity through the mapper and merge through
 * `processFrontMatter` so body and unknown keys survive untouched.
 */
export class ObsidianProjectRepository {
	private readonly queues = new KeyedQueues();
	private readonly folder: string;

	constructor(private readonly deps: NoteVaultDeps) {
		this.folder = normalizeFolder(deps.projectFolder);
	}

	getById(id: ProjectId): Promise<Result<Loaded<Project> | null, RepositoryError>> {
		const file = this.locate(id);
		if (!file) return Promise.resolve(ok(null));
		const read = this.readEntity(file);
		if (!read.ok) {
			// Content-free (SDD §68): opaque id + the error, of which the ledger keeps only
			// the code. The whole error goes in because the ledger is the one module allowed
			// to decide what diagnostics may hold — see `application/ports/diagnostics.ts`.
			this.deps.ledger.record('project', id, read.error);
			return Promise.resolve(err(read.error));
		}
		return Promise.resolve(ok(read.value));
	}

	save(
		project: Project,
		expected: Expected,
	): Promise<Result<Loaded<Project>, RepositoryError>> {
		return this.queues.run(`project:${project.id}`, () => this.saveQueued(project, expected));
	}

	private async saveQueued(
		project: Project,
		expected: Expected,
	): Promise<Result<Loaded<Project>, RepositoryError>> {
		// Existence is established BEFORE anything is written — the insert/update fork the
		// conditional-write comparison needs (SDD §42's rule, applied to a single file).
		const existing = findNoteIdInFolder(this.deps, this.deps.vault, this.folder, project.id);
		const currentVersion = existing ? versionOfFrontmatter(frontmatterOf(this.deps, existing)) : undefined;

		const conflict = checkExpectedVersion('project', project.id, currentVersion, expected);
		if (conflict) return err(conflict);

		const nextRevision = (currentVersion?.revision ?? 0) + 1;
		const dto = { ...projectToPersistence(project, nextRevision) };

		let path: string;
		if (existing) {
			path = existing.path;
			try {
				await writeOwnedFrontmatter(this.deps.fileManager, existing, dto);
			} catch (cause) {
				return err(persistenceError('project.write-failed', `Could not write the note for project ${project.id}.`, cause));
			}
		} else {
			path = freshNotePath(this.deps.vault, this.folder, project.name, project.id);
			try {
				await ensureFolder(this.deps.vault, this.folder);
				await this.deps.vault.create(path, serializeFrontmatter(dto));
			} catch (cause) {
				return err(persistenceError('project.write-failed', `Could not create the note for project ${project.id}.`, cause));
			}
		}

		this.deps.index.upsert({ id: project.id, type: 'renovation-project', path });
		this.deps.echo.markFrontmatter(path, dto);

		return ok({ entity: project, version: { revision: nextRevision, observed: observeFrontmatter(dto) } });
	}

	delete(id: ProjectId, expected: EntityVersion): Promise<Result<void, RepositoryError>> {
		return this.queues.run(`project:${id}`, async () => {
			const file = this.locate(id);
			// A vanished or unindexed note refuses exactly like a stale expectation.
			if (!file) return err(revisionConflict('project', id));
			const conflict = checkExpectedVersion(
				'project',
				id,
				versionOfFrontmatter(frontmatterOf(this.deps, file)),
				expected,
			);
			if (conflict) return err(conflict);

			try {
				await this.deps.fileManager.trashFile(file);
			} catch (cause) {
				return err(persistenceError('project.delete-failed', `Could not delete project note ${file.path}.`, cause));
			}
			this.deps.index.remove(id);
			this.deps.echo.forget(file.path);
			return ok(undefined);
		});
	}

	/**
	 * A per-note refusal is SKIPPED and counted, never returned. One project note this build
	 * cannot parse must not cost the user every other project in the vault — and skipping it
	 * is what makes `migrateNote`'s own claim true here, that a refusal is "scoped to THIS
	 * note ... and the rest of the project loads on" (SDD §92 item 13). This method
	 * contradicted that claim by returning the first failure it met.
	 *
	 * Nothing is lost by skipping: `getById` records every refusal into the diagnostics
	 * ledger before returning it, so the per-entity detail reaches the snapshot and only the
	 * count travels to the view. A VANISHED note is a third case, neither loaded nor counted:
	 * `getById` answers `ok(null)` for it, and it was already skipped here.
	 */
	async listAll(): Promise<Result<ProjectListing, RepositoryError>> {
		const loaded: Loaded<Project>[] = [];
		let refused = 0;
		for (const id of this.deps.index.getIdsByType('renovation-project')) {
			const one = await this.getById(id as ProjectId);
			if (!one.ok) {
				refused += 1;
				continue;
			}
			if (one.value) loaded.push(one.value);
		}
		return ok({ loaded, refused });
	}

	private locate(id: ProjectId): TFile | null {
		return fileAt(this.deps.vault, this.deps.index.getPath(id));
	}

	private readEntity(file: TFile): Result<Loaded<Project>, RepositoryError> {
		const raw = frontmatterOf(this.deps, file);
		const migrated = migrateNote(this.deps.migrations, 'project', raw);
		if (!migrated.ok) return migrated;
		const entity = projectFromPersistence(migrated.value);
		if (!entity.ok) {
			return err(persistenceError('project.frontmatter-invalid', entity.error.message));
		}
		return ok({ entity: entity.value, version: versionOfFrontmatter(raw) });
	}
}
