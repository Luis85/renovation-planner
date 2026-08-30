import { TFile as TFileValue, TFolder, type FileManager, type MetadataCache, type TFile, type Vault } from 'obsidian';
import { type MigrationError, type PersistenceError, type ValidationError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { DiagnosticEntityKind, DiagnosticsLedger } from '../../../application/ports/diagnostics';
import type { EntityId } from '../../../core/identity/EntityId';
import type { MigrationRunner } from '../../persistence/migration/MigrationRunner';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { EchoWindow } from '../../persistence/index/EchoWindow';
import type { ObservationToken } from '../../../application/ports/versioning';
import { parentOf } from './paths';
import { observeFrontmatter } from './digest';

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
 * project loads on (SDD §92 item 13). **That second half is a property of the CALLER, and
 * exactly one listing has it today**: `ObsidianProjectRepository.listAll` skips a note this
 * refuses and returns the rest. `ObsidianPlanRepository.listByProject` and
 * `ObsidianZoneRepository`'s private `list` — which is where both `listByPlan` and
 * `listByProject` end up, so it is ONE site and THREE entry points — still `return one` on
 * the first failure they meet, so
 * one unreadable Zone note blanks every Zone on a Plan Editor canvas rather than costing the
 * user that one Zone. Written down here rather than fixed here, because the sentence above
 * read as settled for three entry points that disprove it. The index scan is the other half of that scope and
 * it works by NOT calling this: `buildProjectIndexEntries` never reads `schema-version`,
 * so a note this refuses is indexed like any other and costs nobody their session.
 *
 * **The guarantee is "refuses to LOAD", never "refuses to write over" — and one WRITE
 * reaches it anyway.** Every SAVE path resolves its existing note through the index
 * (`fileAt` + `versionOfFrontmatter`) and never comes through here, so nothing in
 * a save stops a build that predates a note from overwriting its owned keys with a shape it
 * understands. A DELETE is the exception, and this docblock denied it for a whole slice:
 * `trashNoteBackedEntity` calls `openNoteById` before `checkExpectedVersion`, so an Asset or
 * Requirement note from a future build can be neither loaded nor removed from inside the
 * plugin. That refusal is deliberate rather than incidental — trashing a note this build
 * cannot parse is not obviously safer than declining to — and it is pinned by the
 * 'refuses to DELETE a future-version note' case in `errorPaths.test.ts` rather than
 * described here, which is what the previous version of this paragraph got wrong.
 * Against a SAVE, two things protect such a note today and NEITHER is this gate:
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
 * A file's own mtime and size as one comparable string — what `EchoWindow` records after a
 * write and what `frontmatterOf` compares against on the next read.
 *
 * Deliberately not a content hash: this is asked on every read, and hashing a note's bytes
 * would mean reading them, which `frontmatterOf` is synchronous precisely to avoid. What that
 * costs is a real residue rather than a rounding error, and `EchoWindow.observedFileStat`
 * states it: a write that collides on both halves is served the echo over somebody else's
 * bytes.
 *
 * **A writer takes this reading with NOTHING AWAITED since its own write**, which is a rule
 * about the CALL SITE that no signature here can carry. It is a statement about the file WE
 * wrote, so it is only true while that is still what is on disk. Four of the five writers
 * have nothing but synchronous index bookkeeping in between; `ObsidianZoneRepository` awaits
 * a whole sidecar mutation after its note write and took the reading after that, so an
 * external edit landing in that window was recorded as ours — the same overwrite the guard
 * exists to refuse, reached through the one path with an await in the middle of it. Its
 * regression case is 'does not vouch for an external edit that landed while the sidecar write
 * was in flight', in `tests/infrastructure/obsidian/repositories/contract.test.ts`.
 */
function fileStatToken(file: TFile): string {
	return `${file.stat.mtime}:${file.stat.size}`;
}

/**
 * The same reading, taken through a path rather than a handle, so a writer can ask for it
 * AFTER its own write — the moment that matters, and one the pre-write `TFile` cannot answer
 * on a host that hands out immutable file handles.
 */
export function fileStatAt(vault: Vault, path: string): string | undefined {
	const file = vault.getAbstractFileByPath(path);
	return file instanceof TFileValue ? fileStatToken(file) : undefined;
}

/**
 * The frontmatter of a note — via `MetadataCache`, not raw parsing, with `EchoWindow` as
 * the fallback for the two windows the cache cannot answer for itself.
 *
 * **Obsidian populates its `MetadataCache` asynchronously**, so what `getFileCache` answers
 * is the text Obsidian's parse queue last reached, never necessarily the bytes on disk.
 * Two windows follow from that, and this function has been wrong in each of them:
 *
 * 1. **After a CREATE there is no entry at all.** This used to answer `{}`, which every
 *    caller read as a version-0 document, so the migration runner threw `chain-gap` and the
 *    read failed with "Migrating the … note failed". That is what `create-sample-project`
 *    did on its first run in a real vault, where `CreatePlanCommand` reads back the Project
 *    it had just created to validate the reference.
 * 2. **After a MODIFY the entry is STALE** — present, and parsed from the file's PREVIOUS
 *    version. This used to be returned as-is, under a comment calling the window
 *    undetectable, and it shipped a defect: `SetPlanBackground` wrote the reference and
 *    published `PlanBackgroundChanged`, the Plan Editor re-hydrated off that event inside
 *    the window, and `GetPlan` answered a plan with no background — so the canvas drew
 *    none, and the background appeared only later, when some unrelated action re-read a
 *    note the queue had caught up with in the meantime.
 *
 * **What makes the second window detectable is a reading, not a guess.** Every writer takes
 * the cache's own answer immediately before it writes and hands that token to
 * `markFrontmatter`; a cache still answering exactly that has not been re-parsed since, so
 * the echo record — what this plugin just wrote — is the truthful answer. A cache answering
 * anything else has moved on, and the cache wins.
 *
 * That is why the test is a TOKEN of the pre-write reading and not a revision comparison.
 * A revision cannot tell a lagging cache from a hand edit that dropped or lowered the key,
 * and reading it that way made `VaultChangeAdapter` blind to exactly such an edit —
 * measured, on the two `announcements.test.ts` cases that drive one.
 *
 * **The cache still wins every case it can answer**, which is what keeps a hand edit
 * authoritative: it moves the entry, so the token stops matching on the very next read.
 * A note whose frontmatter a user DELETED answers an entry with no `frontmatter` at all and
 * returns `{}` rather than reaching for the echo — otherwise the change pipeline would
 * never drop it from the index.
 *
 * **The CREATE window below takes no such guard, and the reason is that there is nothing
 * better to withdraw to.** With no cache entry at all the only alternative answer is `{}`,
 * which every caller reads as a version-0 document — that IS defect 1 above. So an external
 * edit landing on a note we have just created, before Obsidian has parsed either write, is
 * answered from the echo. The asymmetry is deliberate: in the MODIFY window withdrawing
 * yields the stale cache, which is wrong but harmless and refuses the next conditional save,
 * while here it yields a refusal to read the note at all.
 *
 * The residue, stated because it is real and not because it is likely: an external edit that
 * collides with our own write on BOTH halves of the file stat is served the echo over its own
 * bytes. That is the one direction of the stat guard's error that is not safe —
 * `EchoWindow.observedFileStat` carries the whole account, and `noteIo.echo.test.ts` pins it
 * as behaviour. Its reach is wider than one read: `VaultChangeAdapter.processNote` reads
 * through here too, so a colliding edit is answered as our own echo and its event is
 * SUPPRESSED. Reads self-correct the moment the cache catches up; the index does not, because
 * that path's one event has already been spent.
 *
 * An earlier draft listed a second residue beside it — an edit restoring a note's frontmatter
 * to byte-identical the pre-write reading. The stat guard closes that one (the edit moves the
 * mtime), so it is not a residue any more except when the stat ALSO collides, which is the
 * paragraph above.
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
	const parsed = cached.frontmatter;
	if (parsed === undefined) return {};
	const written = source.echo.frontmatterAt(file.path);
	if (written === undefined) return parsed;

	// 1. Is this still the file WE wrote? A cache token cannot answer that — an unparsed
	//    external edit is invisible to the cache by definition — so the FILE is asked. A
	//    mismatch withdraws the fallback, which is the safe direction: this guard can only
	//    refuse the echo more often than a version without it, never less.
	const stat = source.echo.observedFileStat(file.path);
	if (stat === undefined || stat !== fileStatToken(file)) return parsed;

	// 2. Is the cache showing a state that is OURS and superseded? Any earlier write of ours
	//    counts, not just the reading taken before the latest one: Obsidian may parse an
	//    intermediate write while a later one is still unparsed.
	if (!source.echo.supersededStates(file.path).has(observeFrontmatter(parsed))) return parsed;
	return written;
}


/**
 * What Obsidian's metadata cache is showing for a note RIGHT NOW, as a token — or
 * `undefined` when it has no entry for the file at all.
 *
 * Deliberately NOT `observeFrontmatter(frontmatterOf(...))`, and the difference is the whole
 * reason this exists: `frontmatterOf` may answer from the echo record, so digesting its
 * result inside the parse-lag window yields a token of what this plugin WROTE rather than of
 * what the cache SHOWED. Threading that as `supersedes` breaks the chain on the second
 * consecutive write inside one window — the cache has not moved, but the recorded token has,
 * so the next read stops recognising the window and serves the stale entry. Measured: the
 * slice-10 cascade marks a requirement stale and recalculates it in one go, and read the
 * marker back instead of the recalculated figure.
 *
 * Every writer hands this to `markFrontmatter`, taken immediately before it writes. It takes
 * an ABSENT file too, because every caller is on a save path whose insert arm has none, and a
 * ternary at each of those was a branch per repository for one question asked one way.
 */
export function cacheReading(source: FrontmatterSource, file: TFile | null): ObservationToken | undefined {
	const cached = file ? source.metadataCache.getFileCache(file) : null;
	if (cached === null) return undefined;
	return observeFrontmatter(cached.frontmatter ?? {});
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

/**
 * Creates each missing folder segment; an existing non-folder at a segment is an error.
 *
 * `created` is an OUT parameter rather than a return value, and the difference is the whole
 * reason it is spelled this way: this function can throw having ALREADY created some of the
 * segments, and a list handed back by `return` is lost on exactly the path that needs it. A
 * caller that passes one is a caller that intends to compensate (`undoEnsureFolder`); the
 * three that pass nothing keep the signature they had.
 */
export async function ensureFolder(vault: Vault, folder: string, created?: string[]): Promise<void> {
	const segments = folder.split('/').filter(Boolean);
	let current = '';
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		const existing = vault.getAbstractFileByPath(current);
		if (!existing) {
			await vault.createFolder(current);
			created?.push(current);
		} else if (!isTFolder(existing)) {
			throw new Error(`${current} exists and is not a folder`);
		}
	}
}

/**
 * `ensureFolder`'s compensation: removes the folders THAT call created, and nothing else.
 *
 * The insert path it exists for is `ObsidianProjectRepository`'s, whose class header
 * predicted this orphan and named design slice 16 as the trigger to close it — that being the
 * first slice in which a user reaches the path by typing a name, and the first in which
 * retrying after a failed create is an ordinary thing to do. Left uncompensated, a
 * `vault.create` that fails after the folder was made leaves an EMPTY folder behind, and
 * `freshProjectFolder` collides on any abstract file at the base path: the retry lands at
 * `<name> <id>`, with a different suffix each time because the command mints a new id per
 * call. Two failed attempts leave two orphans and put the project in a third folder.
 *
 * **Deepest first, and EMPTY only.** Neither rule is tidiness; each keeps the rollback
 * narrower than the damage it undoes.
 * - Deepest first, because a parent this call created can only be empty once the child it
 *   created is gone.
 * - Empty only, because `ensureFolder` walks the CONFIGURED ROOT too and this repository's
 *   queue is keyed per project: a sibling insert that found that root already there and
 *   filled it is the case where trashing what we created takes somebody else's work with it.
 *   Obsidian's `trashFile` on a folder takes everything inside it, so this check is the only
 *   thing standing between a failed create and that.
 *
 * A non-empty folder therefore STOPS the walk rather than being skipped past — every path
 * still to come is an ancestor of it and cannot be empty either. Three states, and only one
 * of them skips, which an earlier draft of this paragraph collapsed into two and got wrong:
 * - GONE (`null`) skips to the parent — something else removed it, so the parent may now be
 *   empty and genuinely ours to take.
 * - A FILE now sits at that path: stop, for the same reason a non-empty folder does. It is
 *   not ours to trash, and its parent is holding it, so no ancestor can be empty either.
 * - Anything else is a folder, and the emptiness rule decides.
 *
 * Returns the paths it tried to remove and could not, for the caller to log. A folder left
 * standing because it is NOT EMPTY is deliberately not among them: that is this function
 * working, not failing.
 *
 * The `catch` deliberately does NOT `break`, and the first draft of it did. A folder whose
 * trash refused is still its parent's child, so the emptiness rule ends the walk on the very
 * next iteration anyway — measured by deleting the `break` and finding all five cases green,
 * which is this repository's own "dead branch that reads as belt and braces". What removing it
 * buys, in the one case where the two differ: a trash that throws having ALREADY moved the
 * folder leaves the parent empty and genuinely ours to take.
 */
export async function undoEnsureFolder(
	vault: Vault,
	fileManager: FileManager,
	created: readonly string[],
): Promise<{ path: string; cause: unknown }[]> {
	const stranded: { path: string; cause: unknown }[] = [];
	for (const path of created.toReversed()) {
		const folder = vault.getAbstractFileByPath(path);
		if (folder === null) continue;
		if (!isTFolder(folder) || folder.children.length > 0) break;
		try {
			await fileManager.trashFile(folder);
		} catch (cause) {
			stranded.push({ path, cause });
		}
	}
	return stranded;
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

