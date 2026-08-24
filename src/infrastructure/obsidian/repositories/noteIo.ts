import type { FileManager, MetadataCache, TFile, TFolder, Vault } from 'obsidian';
import type { PersistenceError } from '../../../core/errors/AppError';

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
	return !!file && typeof file === 'object' && Array.isArray((file as TFolder).children);
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
export function frontmatterOf(metadataCache: MetadataCache, file: TFile): Record<string, unknown> {
	return metadataCache.getFileCache(file)?.frontmatter ?? {};
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
		if (!file.path.startsWith(folder.startsWith('/') ? folder : `${folder}/`)) continue;
		const cached = metadataCache.getFileCache(file)?.frontmatter;
		if (cached && cached['id'] === id) return file;
	}
	return null;
}
