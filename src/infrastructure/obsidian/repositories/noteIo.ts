import { TFile as TFileValue, TFolder, type FileManager, type MetadataCache, type TFile, type Vault } from 'obsidian';
import type { PersistenceError } from '../../../core/errors/AppError';
import { err, ok, type Result } from '../../../core/result/Result';
import type { MigrationRunner } from '../../persistence/migration/MigrationRunner';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
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
 * The migration half of a note read (SDD §44): chain `(kind, schema-version)` up to
 * latest BEFORE the Zod parse. A gap throws inside the runner; here it becomes the same
 * `PersistenceError` shape every other read failure takes.
 */
export function migrateNote(
	migrations: MigrationRunner,
	kind: string,
	raw: Record<string, unknown>,
): Result<unknown, PersistenceError> {
	const version = raw['schema-version'];
	const fromVersion = typeof version === 'number' ? version : 0;
	try {
		return ok(migrations.migrateToLatest(kind, raw, fromVersion));
	} catch (cause) {
		// Through the factory below rather than a literal of the same shape: the `cause`
		// spread is the fiddly half, and a second hand-written copy of it is a second place
		// for `cause: undefined` to start appearing on the error.
		return err(persistenceError(`${kind}.migration-failed`, `Migrating the ${kind} note failed.`, cause));
	}
}

/** The three ways "open this entity's note and read its migrated frontmatter" can land. */
export type OpenedNote =
	| { readonly status: 'missing' }
	| { readonly status: 'error'; error: PersistenceError }
	| { readonly status: 'ok'; file: TFile; raw: Record<string, unknown>; migrated: unknown };

/**
 * The cached frontmatter of a note — via `MetadataCache`, not raw parsing. A file with
 * no cache entry yet reads as no frontmatter, which callers surface as their own error.
 */
export function frontmatterOf(metadataCache: MetadataCache, file: TFile): Record<string, unknown> {
	return metadataCache.getFileCache(file)?.frontmatter ?? {};
}

/**
 * Resolves an entity's note through the index and reads its cached frontmatter plus the
 * migrated document — the identical preamble of all three repositories' `getById`. A
 * missing note is 'missing', never an error ("not found" is ok(null), §36).
 */
export function openNoteById(
	deps: {
		vault: Vault;
		metadataCache: MetadataCache;
		index: ProjectIndex;
		migrations: MigrationRunner;
	},
	kind: string,
	id: string,
): OpenedNote {
	const path = deps.index.getPath(id as never);
	if (!path) return { status: 'missing' };
	const abstractFile = deps.vault.getAbstractFileByPath(path);
	if (!(abstractFile instanceof TFileValue)) return { status: 'missing' };
	const raw = frontmatterOf(deps.metadataCache, abstractFile);
	const migrated = migrateNote(deps.migrations, kind, raw);
	if (!migrated.ok) return { status: 'error', error: migrated.error };
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
	vault: Vault,
	metadataCache: MetadataCache,
	folder: string,
	id: string,
): TFile | null {
	for (const file of vault.getMarkdownFiles()) {
		if (!file.path.startsWith(`${folder}/`)) continue;
		const cached = metadataCache.getFileCache(file)?.frontmatter;
		if (cached && cached['id'] === id) return file;
	}
	return null;
}
