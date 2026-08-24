import { TFile as TFileValue, TFolder, type FileManager, type MetadataCache, type TFile, type Vault } from 'obsidian';
import type { PersistenceError } from '../../../core/errors/AppError';
import { ok, type Result } from '../../../core/result/Result';
import type { MigrationRunner } from '../../persistence/migration/MigrationRunner';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';

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
		return {
			ok: false,
			error: { category: 'Persistence', code: `${kind}.migration-failed`, message: `Migrating the ${kind} note failed.`, ...(cause === undefined ? {} : { cause }) },
		};
	}
}

/** The three ways "open this entity's note and read its migrated frontmatter" can land. */
export type OpenedNote =
	| { readonly status: 'missing' }
	| { readonly status: 'error'; error: PersistenceError }
	| { readonly status: 'ok'; file: TFile; raw: Record<string, unknown>; migrated: unknown };

/**
 * Resolves an entity's note through the index and reads its cached frontmatter plus the
 * migrated document — the identical preamble of all three repositories' `getById`. A
 * missing note is 'missing', never an error ("not found" is ok(null), §36).
 */
/** The cached frontmatter of a note — via `MetadataCache`, not raw parsing. A file with
 * no cache entry yet reads as no frontmatter, which callers surface as their own error. */
export function frontmatterOf(metadataCache: MetadataCache, file: TFile): Record<string, unknown> {
	return metadataCache.getFileCache(file)?.frontmatter ?? {};
}

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

/**
 * The one module the repositories read and write notes through. Everything above
 * `infrastructure/` sees ports; everything inside the repositories calls these helpers,
 * so there is no second place that decides how frontmatter is serialized or how a note
 * is created.
 *
 * The write boundary (`WRITE_BOUNDARY` in eslint.config.mjs) is why this file lives
 * where it does: every vault mutation in the plugin is reachable from one directory.
 */

export function persistenceError(code: string, message: string, cause?: unknown): PersistenceError {
	return { category: 'Persistence', code, message, ...(cause === undefined ? {} : { cause }) };
}

/**
 * Frontmatter as a YAML document for NOTE CREATION. Updates never re-serialize — they
 * go through `FileManager.processFrontMatter`, which merges into whatever is already
 * there and leaves body and unknown keys alone.
 *
 * Strings are JSON-quoted, which is valid YAML and immune to names containing `:` or
 * `#`; sequences are block-style. Key order follows construction order (the schema's).
 */
function yamlScalar(value: unknown): string {
	return typeof value === 'string' ? JSON.stringify(value) : String(value);
}


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
 * The cached frontmatter of a note — via `MetadataCache`, not raw parsing. A file with
 * no cache entry yet reads as no frontmatter, which callers surface as their own error.
 */

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
