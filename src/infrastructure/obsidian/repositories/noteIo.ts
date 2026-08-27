import { TFile as TFileValue, TFolder, type FileManager, type MetadataCache, type TFile, type Vault } from 'obsidian';
import { type MigrationError, type PersistenceError, type ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { DiagnosticEntityKind, DiagnosticsLedger } from '../../../application/ports/diagnostics';
import type { EntityId } from '../../../core/identity/EntityId';
import type { MigrationRunner } from '../../persistence/migration/MigrationRunner';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { EchoWindow } from '../../persistence/index/EchoWindow';
import { parentOf } from './paths';

/**
 * The one module the repositories read and write notes through. Everything above
 * `infrastructure/` sees ports; everything inside the repositories calls these helpers,
 * so there is no second place that decides how frontmatter is serialized or how a note
 * is created.
 *
 * The write boundary (`WRITE_BOUNDARY` in eslint.config.mjs) is why this file lives
 * where it does: every vault mutation in the plugin is reachable from one directory.
 */

/**
 * Every `PersistenceError` this layer produces, from one place — the geometry store and
 * the three repositories all call THIS rather than each keeping a copy, and the `cause`
 * spread is the reason it is worth a function at all.
 */
export function persistenceError(code: string, message: string, cause?: unknown): PersistenceError {
	return { category: 'Persistence', code, message, ...(cause === undefined ? {} : { cause }) };
}

/**
 * The `MigrationError` twin of the factory above. The runner throws tagged `Error`
 * instances (its contract has no Result channel); the read path converts them HERE, so
 * a migration refusal keeps its own category instead of being flattened into
 * `Persistence` — which matters because "this build is too old for this note" and
 * "the vault write failed" are different sentences to a user (SDD §87 rule 7).
 */
function migrationError(code: string, message: string, cause: unknown): MigrationError {
	// `cause` is REQUIRED, not optional: this factory exists to translate something that
	// was thrown, so there is always one, and the optional spelling left an arm nothing
	// could take — an unreachable branch is deleted rather than tested around.
	return { category: 'Migration', code, message, cause };
}

/**
 * One step of the Error Boundary (SDD §66) for migration refusals, shared by the two
 * read paths that run the runner — notes (`migrateNote`) and the geometry sidecar. A
 * throw CARRYING the runner's `{ category: 'Migration' }` tag keeps its code and
 * category; anything else thrown under the read stays a `Persistence` failure as
 * before.
 */
export function mappedMigrationFailure(kind: string, cause: unknown): MigrationError | PersistenceError {
	const tagged = cause as { code?: unknown; category?: unknown } | null;
	if (tagged !== null && typeof tagged === 'object' && tagged.category === 'Migration' && typeof tagged.code === 'string') {
		return migrationError(tagged.code, cause instanceof Error ? cause.message : String(cause), cause);
	}
	return persistenceError(`${kind}.migration-failed`, `Migrating the ${kind} document failed.`, cause);
}

/**
 * The migration half of a note read (SDD §44): chain `(kind, schema-version)` up to
 * latest BEFORE the Zod parse. The failure vocabulary is the spec's, not one flattened
 * shape: a version field that is present but not a number is a `ValidationError`
 * (malformed data), while everything the runner refuses — a future version this build
 * predates, a gap in the chain — keeps the runner's `Migration` category. Both are
 * scoped to THIS note: the caller answers 'error' for this entity and the rest of the
 * project loads on (SDD §92 item 13). The index scan is the other half of that scope and
 * it works by NOT calling this: `buildProjectIndexEntries` never reads `schema-version`,
 * so a note this refuses is indexed like any other and costs nobody their session.
 *
 * **The guarantee is "refuses to LOAD", never "refuses to write over" — and one WRITE
 * reaches it anyway.** Every SAVE path resolves its existing note through
 * `findNoteIdInFolder` + `versionOfFrontmatter` and never comes through here, so nothing in
 * a save stops a build that predates a note from overwriting its owned keys with a shape it
 * understands. A DELETE is the exception, and this docblock denied it for a whole slice:
 * `trashNoteBackedEntity` calls `openNoteById` before `checkExpectedVersion`, so an Asset or
 * Requirement note from a future build can be neither loaded nor removed from inside the
 * plugin. That refusal is deliberate rather than incidental — trashing a note this build
 * cannot parse is not obviously safer than declining to — and it is pinned by the
 * 'refuses to DELETE a future-version note' case in `errorPaths.test.ts` rather than
 * described here, which is what the previous version of this paragraph got wrong.
 * Two things protect such a note today and NEITHER is this gate:
 * every command loads before it saves, and the load refuses — a property of the callers;
 * and `schema-version` is an owned key, so an expectation minted before the note changed
 * refuses as an external modification. A writer holding a CURRENT expectation meets
 * nothing at all, which is what the "is a READ gate" case in
 * `tests/infrastructure/obsidian/repositories/errorPaths.test.ts` pins as true today.
 * No command bypasses the load, so this is a narrowing of the claim rather than a live
 * defect; closing it means running this check on the save side too, at FOUR call
 * sites rather than one — `saveNoteBackedEntity` covers the Asset and the Requirement, and
 * the Project, Plan and Zone repositories each carry a save of their own.
 */
export function migrateNote(
	migrations: MigrationRunner,
	kind: string,
	raw: Record<string, unknown>,
): Result<unknown, PersistenceError | MigrationError | ValidationError> {
	const version = raw['schema-version'];
	if (version !== undefined && typeof version !== 'number') {
		return err({
			category: 'Validation',
			code: `${kind}.schema-version-malformed`,
			message: `The ${kind} note's schema-version is ${JSON.stringify(version)}, not a number.`,
		});
	}
	const fromVersion = typeof version === 'number' ? version : 0;
	try {
		return ok(migrations.migrateToLatest(kind, raw, fromVersion));
	} catch (cause) {
		// Through `mappedMigrationFailure` rather than a literal of the shape: the
		// `cause` spread is the fiddly half, and a second hand-written copy of it is a
		// second place for `cause: undefined` to start appearing on the error.
		return err(mappedMigrationFailure(kind, cause));
	}
}

/** The three ways "open this entity's note and read its migrated frontmatter" can land. */
export type OpenedNote =
	| { readonly status: 'missing' }
	| { readonly status: 'error'; error: PersistenceError | MigrationError | ValidationError }
	| { readonly status: 'ok'; file: TFile; raw: Record<string, unknown>; migrated: unknown };

/** What reading a note's frontmatter needs: Obsidian's cache, and our own last write. */
export interface FrontmatterSource {
	readonly metadataCache: MetadataCache;
	readonly echo: EchoWindow;
}

/**
 * The frontmatter of a note — via `MetadataCache`, not raw parsing, with `EchoWindow` as
 * the fallback for the one case the cache cannot answer.
 *
 * **Obsidian populates its `MetadataCache` asynchronously.** A note read back in the same
 * tick it was created has NO cache entry, and this function used to answer `{}` for it —
 * which every caller then read as a version-0 document, so the migration runner threw
 * `chain-gap` and the read failed with "Migrating the … note failed". That is not a
 * hypothetical: it is what `create-sample-project` did on its first run in a real vault,
 * where `CreatePlanCommand` reads back the Project it had just created to validate the
 * reference. The suite could not see it, because `FakeMetadataCache` parsed the vault's own
 * text synchronously — a fake kinder than the real thing, which now models the delay.
 *
 * The cache is still PREFERRED and the fallback is consulted only when there is no cache
 * entry at all. That ordering is deliberate: the echo record is what this plugin last
 * wrote, so preferring it would mean serving our own bytes over a hand edit for as long as
 * the debounced change pipeline had not run. A path that has ever been parsed always has a
 * cache entry, so the fallback answers exactly the window it exists for.
 *
 * What this still does NOT fix, so the sentence stays narrower than the function: a cache
 * entry that is STALE — present but parsed from an earlier version of the file — is
 * returned as-is, exactly as before. That window belongs to Obsidian's parse queue and no
 * fallback here can detect it.
 */
export function frontmatterOf(source: FrontmatterSource, file: TFile): Record<string, unknown> {
	// On the CACHE ENTRY, not on `.frontmatter`, and that distinction is the whole
	// correctness of the fallback. `getFileCache` answers `CachedMetadata | null`: null
	// means Obsidian has no entry for this file AT ALL, while a file it has parsed and
	// found no frontmatter in answers an object whose `frontmatter` is undefined. Reading
	// `getFileCache(file)?.frontmatter` collapses the two — and then a note whose
	// frontmatter a user DELETED would be answered from the echo record, so the change
	// pipeline would never drop it from the index. Only the first case may fall back.
	const cached = source.metadataCache.getFileCache(file);
	if (cached === null) return source.echo.frontmatterAt(file.path) ?? {};
	return cached.frontmatter ?? {};
}

/**
 * Resolves an entity's note through the index and reads its cached frontmatter plus the
 * migrated document — the identical preamble of all three repositories' `getById`. A
 * missing note is 'missing', never an error ("not found" is ok(null), §36).
 *
 * A refusal here is also RECORDED, not only returned: opaque entity id plus error code
 * into the diagnostics ledger (SDD §68) — never the name, body or path content.
 */
export function openNoteById(
	deps: FrontmatterSource & {
		vault: Vault;
		index: ProjectIndex;
		migrations: MigrationRunner;
		ledger: DiagnosticsLedger;
	},
	// `kind` is the closed diagnostics vocabulary rather than a free string, and `id` is a
	// branded `EntityId` rather than one: those two are what this function hands the ledger
	// below, so narrowing them HERE is what leaves the recording call site nothing to put
	// content into. Narrowing `id` also retired an `as never` at the index lookup, which
	// was the cast covering exactly this mismatch.
	kind: DiagnosticEntityKind,
	id: EntityId<string>,
): OpenedNote {
	const path = deps.index.getPath(id);
	if (!path) return { status: 'missing' };
	const abstractFile = deps.vault.getAbstractFileByPath(path);
	if (!(abstractFile instanceof TFileValue)) return { status: 'missing' };
	const raw = frontmatterOf(deps, abstractFile);
	const migrated = migrateNote(deps.migrations, kind, raw);
	if (!migrated.ok) {
		deps.ledger.record(kind, id, migrated.error);
		return { status: 'error', error: migrated.error };
	}
	return { status: 'ok', file: abstractFile, raw, migrated: migrated.value };
}

function yamlScalar(value: unknown): string {
	return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

/**
 * Frontmatter as a YAML document for NOTE CREATION. Updates never re-serialize — they
 * go through `FileManager.processFrontMatter`, which merges into whatever is already
 * there and leaves body and unknown keys alone.
 *
 * Strings are JSON-quoted, which is valid YAML and immune to names containing `:` or
 * `#`; sequences are block-style. Key order follows construction order (the schema's).
 */
export function serializeFrontmatter(dto: Record<string, unknown>): string {
	const lines: string[] = ['---'];
	for (const [key, value] of Object.entries(dto)) {
		if (Array.isArray(value)) {
			if (value.length === 0) {
				lines.push(`${key}: []`);
				continue;
			}
			lines.push(`${key}:`);
			for (const item of value) lines.push(`  - ${yamlScalar(item)}`);
		} else if (value === null) {
			lines.push(`${key}: null`);
		} else {
			lines.push(`${key}: ${yamlScalar(value)}`);
		}
	}
	lines.push('---', '');
	return lines.join('\n');
}


export function isTFolder(file: unknown): file is TFolder {
	return file instanceof TFolder;
}

/** Creates each missing folder segment; existing non-folder at a segment is an error. */
export async function ensureFolder(vault: Vault, folder: string): Promise<void> {
	const segments = folder.split('/').filter(Boolean);
	let current = '';
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		const existing = vault.getAbstractFileByPath(current);
		if (!existing) {
			await vault.createFolder(current);
		} else if (!isTFolder(existing)) {
			throw new Error(`${current} exists and is not a folder`);
		}
	}
}

/**
 * Byte-for-byte note restore — the compensating write of a failed two-file sequence, for
 * whichever entity is compensating. `entity` names the caller only so the refusal reads as
 * its own (`plan.restore-failed`, `zone.restore-failed`).
 *
 * MODIFY when a file is still at the path, CREATE when it is not, because both happen: a
 * failed sidecar write after an UPDATE leaves the note in place, while one after a DELETE
 * has already trashed it. The Plan repository reaches only the second case and previously
 * had a create-only copy of this; the two drifted into a clone group the day a path helper
 * made them line up, which is the argument for one function rather than two that agree.
 *
 * Byte-for-byte matters beyond tidiness: the echo window still holds the token for these
 * exact bytes, so the vault-change pipeline correctly reads any event about them as an echo
 * of this plugin's own write rather than as a foreign edit.
 *
 * The CALLER must hold the entity's queue section — outside it, a restore races the next
 * writer and undoes that writer's work instead of its own.
 */
export async function restoreNoteText(
	vault: Vault,
	entity: string,
	path: string,
	text: string,
): Promise<Result<void, PersistenceError>> {
	const existing = vault.getAbstractFileByPath(path);
	try {
		if (existing instanceof TFileValue) {
			await vault.modify(existing, text);
		} else {
			await ensureFolder(vault, parentOf(path));
			await vault.create(path, text);
		}
		return ok(undefined);
	} catch (cause) {
		return err(persistenceError(`${entity}.restore-failed`, `Could not restore ${entity} note ${path}.`, cause));
	}
}

/** Merges the plugin-owned keys into an existing note without touching body or extras. */
export async function writeOwnedFrontmatter(
	fileManager: FileManager,
	file: TFile,
	owned: Record<string, unknown>,
): Promise<void> {
	await fileManager.processFrontMatter(file, (frontmatter) => {
		Object.assign(frontmatter, owned);
	});
}

/**
 * The note whose frontmatter declares `id` inside `folder` — the INSERT-time collision
 * check. Filename is not identity, so "does an entity with this ID exist" can only be
 * answered by looking at frontmatter; the scan is over files the project folder actually
 * holds.
 */
export function findNoteIdInFolder(
	source: FrontmatterSource,
	vault: Vault,
	folder: string,
	id: string,
): TFile | null {
	for (const file of vault.getMarkdownFiles()) {
		if (!file.path.startsWith(`${folder}/`)) continue;
		// Through `frontmatterOf` rather than the cache directly, so a note this plugin
		// created moments ago is found here too. Without it a second save of the same
		// entity takes the INSERT path and creates a duplicate note beside the first.
		if (frontmatterOf(source, file)['id'] === id) return file;
	}
	return null;
}
