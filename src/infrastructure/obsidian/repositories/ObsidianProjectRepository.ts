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
	cacheReading,
	fileStatAt,
	ensureFolder,
	frontmatterOf,
	migrateNote,
	persistenceError,
	serializeFrontmatter,
	undoEnsureFolder,
	writeOwnedFrontmatter,
} from './noteIo';
import { observeFrontmatter } from './digest';
import { checkExpectedVersion, versionOfFrontmatter } from './versionCheck';
import { freshNotePath, freshProjectFolder } from './paths';
import { foldersOverlap } from './foldersOverlap';
import { KeyedQueues } from './KeyedQueues';
import type { NoteVaultDeps } from './NoteVaultDeps';
import { fileAt } from './NoteVaultDeps';

/**
 * The Obsidian-backed ProjectRepository (SDD §36–38): one Markdown note per Project
 * inside the project folder; frontmatter is the whole persisted state. The simplest of the
 * note-backed repositories — ONE file per entity, and no sidecar.
 *
 * **Its failure story is "the write failed, nothing was written" — but only since design
 * slice 16, and this header spent two slices recording why it was not.** The insert path
 * calls `ensureFolder` before `vault.create`, and the `catch` around the pair used to
 * compensate nothing, so a create that failed after the folder was made left an EMPTY FOLDER
 * behind. No note is written, reads resolve by id, and a folder name reaches no UI (filename
 * is never identity, §83) — but the orphan was COUPLED to the next attempt:
 * `freshProjectFolder` collides on any abstract file at the base path, folders included, so a
 * retry landed at `<name> <id>` rather than `<name>`, with a DIFFERENT suffix each time
 * because `CreateProjectCommand` mints a new id per call. Two failed attempts left two orphan
 * folders and put the project in a third.
 *
 * It was recorded rather than compensated for as long as `seedSampleProject` was the insert
 * arm's only production caller — the same reason `sampleProject.ts` gives for the partial
 * notes a failed seed leaves behind — with the trigger to revisit written into this header:
 * slice 16's project-creation form, being the first time a user reaches this path by typing a
 * name and the first time retrying after a failed create is an ordinary thing to do. That
 * slice landed and a review of it asked for exactly the recorded trigger, so the catch
 * compensates through `undoEnsureFolder` now. The obstacle the old note named — that
 * `ensureFolder` also creates the CONFIGURED ROOT, which may be a folder the user owns and
 * has filled — is what makes the rollback narrow rather than absent: only the folders THIS
 * call created, deepest first, and only while each is still empty. `undoEnsureFolder`'s own
 * docblock carries both rules and why each is load-bearing.
 *
 * Raw frontmatter never leaves this class: reads migrate, schema-parse and map before
 * returning; writes lower the entity through the mapper and merge through
 * `processFrontMatter` so body and unknown keys survive untouched.
 */
export class ObsidianProjectRepository {
	private readonly queues = new KeyedQueues();

	/**
	 * `newProjectRoot` is the plugin setting — where a NEW project's folder is created, and
	 * nothing else. It is this repository's alone rather than a shared `NoteVaultDeps`
	 * field, because it is the only one that ever writes a note whose folder does not
	 * already exist to be derived from.
	 *
	 * `libraryFolder` is the other plugin setting, and it is here for the same reason: this
	 * is the one repository that chooses a folder, so it is the one that can refuse an
	 * overlapping one (§83). A stored copy rather than a value read per call is correct
	 * rather than a slice-18 relapse — it is a SETTING and not a derived path, and
	 * `saveSettings` replaces the whole composition root, so this copy cannot outlive the
	 * setting it was built from.
	 */
	constructor(
		private readonly deps: NoteVaultDeps,
		private readonly newProjectRoot: string,
		private readonly libraryFolder: string,
	) {}

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
		// Through the INDEX, not a folder scan — `locate`, the same lookup `getById` and
		// `delete` use. Under ADR-0013 a project's folder is where its note sits, so
		// scanning "the project's folder" for the project's own note presumes the answer.
		// The index is also the more reliable half of what the folder scan's own comment
		// worried about — `save` upserts synchronously before returning, so a note created
		// moments ago is known here before any MetadataCache has parsed it.
		const existing = this.locate(project.id);
		const currentVersion = existing ? versionOfFrontmatter(frontmatterOf(this.deps, existing)) : undefined;

		const supersedes = cacheReading(this.deps, existing);

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
			const folder = freshProjectFolder(this.deps.vault, this.newProjectRoot, project.name, project.id);
			// §83, the first of two doors. BEFORE `ensureFolder`, so a refusal creates nothing —
			// the orphan-folder compensation this class already carries is for a write that
			// failed, not for a refusal it could have made first.
			if (foldersOverlap(folder, this.libraryFolder)) {
				return err(
					persistenceError(
						'project.folder-overlaps-library',
						`Project folder ${folder} overlaps the library folder ${this.libraryFolder}.`,
					),
				);
			}
			path = freshNotePath(this.deps.vault, folder, project.name, project.id);
			// DECLARED outside the `try`, because `ensureFolder` can throw having already made
			// some of the segments and the catch has to see those. `ObsidianPlanRepository`'s
			// sidecar compensation is the same shape one file over, including the log line for a
			// compensation that itself refuses.
			const createdFolders: string[] = [];
			try {
				await ensureFolder(this.deps.vault, folder, createdFolders);
				await this.deps.vault.create(path, serializeFrontmatter(dto));
			} catch (cause) {
				const stranded = await undoEnsureFolder(this.deps.vault, this.deps.fileManager, createdFolders);
				for (const failure of stranded) {
					this.deps.logger.error('project.insert-compensation-failed', { id: project.id, path: failure.path, cause: failure.cause });
				}
				return err(persistenceError('project.write-failed', `Could not create the note for project ${project.id}.`, cause));
			}
		}

		this.deps.index.upsert({ id: project.id, type: 'renovation-project', path });
		this.deps.echo.markFrontmatter(path, dto, { reading: supersedes, stat: fileStatAt(this.deps.vault, path) });

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
	 * Nothing is lost by skipping, up to a bound worth naming: `getById` records every refusal
	 * into the diagnostics ledger before returning it, so the per-entity detail reaches the
	 * snapshot and only the count travels to the view. The ledger holds `MAX_ISSUES = 200`
	 * and evicts OLDEST FIRST (`infrastructure/logging/diagnosticsLedger.ts`), so past 200
	 * DISTINCT `(kind, id, code)` triples the earliest refusals do fall off the snapshot while
	 * still being counted here. Deduplication on that triple is what keeps the bound out of
	 * reach in practice — one broken note re-read on every hydrate records once — but "nothing
	 * is lost" is a category word and this is where it stops being one.
	 * A VANISHED note is a third case, neither loaded nor counted:
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
