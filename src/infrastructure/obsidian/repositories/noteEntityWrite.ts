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
	serializeFrontmatter,
	writeOwnedFrontmatter,
} from './noteIo';
import { checkExpectedVersion, versionOfFrontmatter } from './versionCheck';
import { observeFrontmatter } from './digest';
import { freshNotePath } from './paths';
import { fileAt } from './NoteVaultDeps';
import type { NoteVaultDeps } from './NoteVaultDeps';

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

/** A missing note fails the conditional delete the same way a stale revision does. */
export async function trashNoteBackedEntity(
	deps: NoteVaultDeps,
	kind: DiagnosticEntityKind,
	id: EntityId<string>,
	deleteFailedCode: string,
	expected: EntityVersion,
): Promise<Result<void, RepositoryError>> {
	const opened = openNoteById(deps, kind, id);
	if (opened.status === 'missing') return err(revisionConflict(kind, id));
	if (opened.status === 'error') return err(opened.error);
	const conflict = checkExpectedVersion(kind, id, versionOfFrontmatter(opened.raw), expected);
	if (conflict) return err(conflict);
	try {
		await deps.fileManager.trashFile(opened.file);
	} catch (cause) {
		return err(persistenceError(deleteFailedCode, `Could not delete ${kind} ${id}.`, cause));
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
