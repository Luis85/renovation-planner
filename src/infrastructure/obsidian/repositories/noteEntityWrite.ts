import type { ValidationError } from '../../../core/errors/AppError';
import type { RepositoryError } from '../../../application/ports/repositoryErrors';
import { ok, err, type Result } from '../../../core/result/Result';import type { ProjectId } from '../../../domain/project/ProjectId';
import type { EntityId } from '../../../core/identity/EntityId';
import type { DiagnosticEntityKind } from '../../../application/ports/diagnostics';
import type {
	EntityVersion,
	Expected,
	Loaded,
} from '../../../application/ports/versioning';
import { revisionConflict } from '../../../application/ports/versioning';
import {
	cacheReading,
	fileStatAt,
	ensureFolder,
	frontmatterOf,
	openNoteById,
	persistenceError,
	restoreNoteText,
	serializeFrontmatter,
	writeOwnedFrontmatter,
} from './noteIo';
import { checkExpectedVersion, versionOfFrontmatter } from './versionCheck';
import { observeFrontmatter } from './digest';
import { freshNotePath } from './paths';
import { fileAt } from './NoteVaultDeps';
import type { NoteVaultDeps } from './NoteVaultDeps';
import type { ProjectIndexEntry } from '../../../application/ports/ProjectIndex';

/**
 * The conditional note write the asset and requirement repositories share — the Zone
 * repository's six-step save contract without a geometry sidecar: validate fully before
 * any I/O, snapshot, compare-and-swap, write, sync index upsert + echo. Parameterised by
 * a small spec so each repository keeps its own mapper, folder and error codes while the
 * SEQUENCE lives here once.
 */
export interface NoteWriteSpec<TEntity> {
	readonly kind: string;
	readonly indexType: 'renovation-asset' | 'renovation-requirement';
	/**
	 * Where an INSERT creates the note, and `undefined` when the folder did not resolve —
	 * which is the owning project's folder (ADR-0013) for a Requirement, and never happens
	 * for an Asset, whose folder is the configured library's and is always a real path.
	 * Only the insert path reads it: an UPDATE writes where the
	 * note already is, so a save is refused for an unresolvable folder only when it has to
	 * choose a location. `undefined` is a refusal rather than a fallback — writing to a
	 * defaulted path when the real one is unknown is how a note lands in a parallel tree
	 * beside the user's work.
	 */
	readonly notesFolder: string | undefined;
	/**
	 * The project this entity's index entry is filed under, or `undefined` for a catalogue
	 * entry that belongs to no project (§59, amended by design slice 19). It is a function
	 * of the entity rather than a member of the CONSTRAINT because the two kinds sharing
	 * this write disagree: a Requirement carries its project, an Asset has none.
	 */
	readonly projectId: (entity: TEntity) => ProjectId | undefined;
	/**
	 * Owned keys this build has RETIRED, deleted from an existing note on its next save.
	 * Omitting a key from the DTO cannot express removal — the write is a merge; see
	 * `writeOwnedFrontmatter`.
	 */
	readonly retiredKeys?: readonly string[];
	/** The fresh-note file name base — an Asset's name, a Requirement's composed name. */
	readonly entryName: (entity: TEntity) => string;
	readonly toPersistence: (entity: TEntity, revision: number) => Record<string, unknown>;
	readonly preWriteValid: (dto: Record<string, unknown>) => boolean;
	readonly validationCode: string;
	readonly writeFailedCode: string;
}

export async function saveNoteBackedEntity<TEntity extends { readonly id: EntityId<string> }>(
	deps: NoteVaultDeps,
	spec: NoteWriteSpec<TEntity>,
	entity: TEntity,
	expected: Expected,
): Promise<Result<Loaded<TEntity>, RepositoryError>> {
	// Through the INDEX, not a scan of the derived folder — the same lookup `getById` and
	// `delete` use. Slice 18 bounded discovery by what a note DECLARES rather than by where
	// it sits, so an asset or requirement note the user filed elsewhere is read, indexed and
	// deletable; the scan could not see it, `currentVersion` came back undefined, and the
	// save answered a permanent `<kind>.revision-conflict`. This ONE site covers both kinds.
	//
	// What the reliance costs when the index is STALE — this writes owned frontmatter to
	// whatever file now sits at that path, and an insert past a forgotten entry writes a
	// second note carrying the same id — is written down once, at `freshNotePath`.
	const existing = fileAt(deps.vault, deps.index.getPath(entity.id));
	const currentVersion = existing
		? versionOfFrontmatter(frontmatterOf(deps, existing))
		: undefined;

	// Taken from the CACHE and not from `currentVersion`, which may itself have come from
	// the echo — see `cacheReading`.
	const supersedes = cacheReading(deps, existing);

	const conflict = checkExpectedVersion(spec.kind, entity.id, currentVersion, expected);
	if (conflict) return err(conflict);

	const nextRevision = (currentVersion?.revision ?? 0) + 1;
	const dto = spec.toPersistence(entity, nextRevision);
	if (!spec.preWriteValid(dto)) {
		return err({ category: 'Validation', code: spec.validationCode, message: 'Pre-write validation failed.' });
	}

	let notePath: string;
	try {
		if (existing) {
			notePath = existing.path;
			await writeOwnedFrontmatter(deps.fileManager, existing, dto, spec.retiredKeys);
		} else {
			// The insert path is the only one that has to choose a location, so it is the
			// only one an unresolvable project folder can refuse. Nothing has been written
			// at this point, which is what makes the refusal safe here.
			const notesFolder = spec.notesFolder;
			if (notesFolder === undefined) {
				return err(
					persistenceError(
						`${spec.kind}.project-folder-unresolved`,
						`Could not resolve the folder of project ${String(spec.projectId(entity))} for ${spec.kind} ${entity.id}.`,
					),
				);
			}
			await ensureFolder(deps.vault, notesFolder);
			notePath = freshNotePath(deps.vault, notesFolder, spec.entryName(entity), entity.id);
			await deps.vault.create(notePath, serializeFrontmatter(dto));
		}
	} catch (cause) {
		return err(persistenceError(spec.writeFailedCode, `Could not write ${spec.kind} ${entity.id}.`, cause));
	}

	deps.index.upsert({
		id: entity.id,
		type: spec.indexType,
		path: notePath,
		projectId: spec.projectId(entity),
	});
	// The reading the cache gave BEFORE this write, so a read landing inside Obsidian parse
	// lag can tell a cache that has not caught up from one that has. Undefined on the insert
	// path, where there was no entry to supersede.
	deps.echo.markFrontmatter(notePath, dto, { reading: supersedes, stat: fileStatAt(deps.vault, notePath) });
	return ok({
		entity,
		version: { revision: nextRevision, observed: observeFrontmatter(dto) },
	});
}

/**
 * The per-kind facts of a delete. One object rather than two more positional arguments
 * because `max-params` is five and `deps`, `kind`, `id` and `expected` already fill it —
 * and because these two travel together: a kind that owns a second file owes a code for
 * the refusal that removing it can produce.
 */
export interface NoteDeleteSpec {
	readonly deleteFailedCode: string;
	/**
	 * A SECOND file this entity's delete owns, removed AFTER the note is trashed and BEFORE
	 * the index entry goes — `ObsidianPlanRepository.delete`'s order, at the second door
	 * that now has two files to keep consistent. Absent for a kind whose note is the whole
	 * of it (a Requirement).
	 *
	 * **Note first, and the ordering is the decision rather than an accident of which line
	 * came first.** Removing the sidecar first would need no compensation at all — nothing
	 * has been deleted when it refuses — and its OTHER failure is the one that decides:
	 * a sidecar gone with the note's trash then refusing leaves an entity whose geometry has
	 * been destroyed and which reports nothing, because an absent asset sidecar reads as a
	 * shapeless asset rather than as an error (`AssetGeometryStore`). Note-first trades that
	 * silent loss for a failure this function can undo.
	 */
	readonly alsoRemove?: () => Promise<Result<void, RepositoryError>>;
}

/**
 * A missing note fails the conditional delete the same way a stale revision does.
 *
 * Where `spec.alsoRemove` is given, the note's bytes are snapshotted BEFORE anything is
 * deleted and restored when that second removal refuses, so a failed `Result` never means
 * "partly done" (SDD §42). This function never removes the index entry until it succeeds —
 * which is what keeps the restored note READABLE, every read here resolving through the
 * index — and that is a statement about this function and NOT about the vault. Obsidian's
 * own delete event can take the entry out from under it, so the entry and the echo record
 * are captured and PUT BACK beside the bytes; the inline comments at both sites carry the
 * race and what each half costs on its own.
 */
export async function trashNoteBackedEntity(
	deps: NoteVaultDeps,
	kind: DiagnosticEntityKind,
	id: EntityId<string>,
	expected: EntityVersion,
	spec: NoteDeleteSpec,
): Promise<Result<void, RepositoryError>> {
	const opened = openNoteById(deps, kind, id);
	if (opened.status === 'missing') return err(revisionConflict(kind, id));
	if (opened.status === 'error') return err(opened.error);
	const conflict = checkExpectedVersion(kind, id, versionOfFrontmatter(opened.raw), expected);
	if (conflict) return err(conflict);

	const notePath = opened.file.path;
	// Only where there is something to compensate FOR. A kind with no second file could
	// never reach `restoreNoteText` below, so reading its note would add a failure mode to a
	// delete that has no use for what the read returns. The empty default is never READ:
	// `alsoRemove` gates both the assignment and the only site that consumes it.
	let noteText = '';
	// What the index held BEFORE anything was trashed. The docblock above says the entry
	// "survives such a refusal untouched", which is true of what THIS function does and is
	// not a claim about the vault: trashing the note raises Obsidian's delete event, and
	// `VaultChangeAdapter.processPath` finds no `TFile` at the path and takes the entry and
	// the echo record out — possibly before `alsoRemove` has even refused. Restoring the
	// bytes then leaves an entity nothing can find, because every read here resolves through
	// the index. Captured for the same reason `PlanGeometryStore`'s delete captures its path.
	let indexed: ProjectIndexEntry | undefined;
	if (spec.alsoRemove) {
		indexed = deps.index.entries().find((entry) => entry.id === id);
		try {
			noteText = await deps.vault.read(opened.file);
		} catch (cause) {
			return err(persistenceError(spec.deleteFailedCode, `Could not read ${kind} note ${notePath}.`, cause));
		}
	}

	try {
		await deps.fileManager.trashFile(opened.file);
	} catch (cause) {
		return err(persistenceError(spec.deleteFailedCode, `Could not delete ${kind} ${id}.`, cause));
	}

	const removed = spec.alsoRemove ? await spec.alsoRemove() : ok(undefined);
	if (!removed.ok) {
		const restored = await restoreNoteText(deps.vault, kind, notePath, noteText);
		if (restored.ok) {
			// BOTH halves, because the pipeline needs both and each fails differently. Without
			// the entry the note is on disk and unreachable. Without the echo mark the RESTORE's
			// own create event is read inside Obsidian's parse lag, where the cache has no entry
			// and `frontmatterOf` has no echo to fall back on, so the note reads as none of ours
			// and the entry just put back is taken out again — with no later event to repair it.
			//
			// **This `if` NARROWS a type and cannot discriminate**, which is a different reason
			// from the ones around it and is why its false arm is uncovered rather than untested:
			// `openNoteById` resolved through this very index and returned `missing` if it held
			// nothing, and the capture is the next synchronous statement, so `indexed` is
			// provably present here. What the guard buys is `ProjectIndexEntry` where `find`
			// answers `ProjectIndexEntry | undefined`. Deleting it is a build error, not a
			// behaviour change.
			if (indexed) deps.index.upsert(indexed);
			deps.echo.markFrontmatter(notePath, opened.raw, { reading: undefined, stat: fileStatAt(deps.vault, notePath) });
		} else {
			// Logged, never swallowed (SDD §42): the ORIGINAL failure is what the caller is
			// owed, and a compensation that could not write is the only account of the note
			// that is now gone with its second file still there.
			deps.logger.error(`${kind}.delete-compensation-failed`, { id, cause: restored.error });
		}
		return err(persistenceError(spec.deleteFailedCode, `Could not remove the second file of ${kind} ${id}.`, removed.error));
	}

	deps.index.remove(id);
	return ok(undefined);
}

/**
 * The read half of the same contract: resolve through the index, answer ok(null) for a
 * missing note, surface a read error as itself, and hand the mapper what migrated.
 */
export function readNoteBackedEntity<T>(
	deps: NoteVaultDeps,
	kind: DiagnosticEntityKind,
	id: EntityId<string>,
	fromPersistence: (migrated: unknown) => Result<T, ValidationError>,
	entityInvalidCode: string,
): Promise<Result<Loaded<T> | null, RepositoryError>> {
	const opened = openNoteById(deps, kind, id);
	if (opened.status === 'missing') return Promise.resolve(ok(null));
	if (opened.status === 'error') return Promise.resolve(err(opened.error));
	const entity = fromPersistence(opened.migrated);
	if (!entity.ok) {
		return Promise.resolve(err(persistenceError(entityInvalidCode, entity.error.message)));
	}
	return Promise.resolve(ok({ entity: entity.value, version: versionOfFrontmatter(opened.raw) }));
}
