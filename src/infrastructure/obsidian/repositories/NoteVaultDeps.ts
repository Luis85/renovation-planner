import type { FileManager, MetadataCache, TFile, Vault } from 'obsidian';
import type { Logger } from '../../../application/ports/Logger';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { MigrationRunner } from '../../persistence/migration/MigrationRunner';
import type { EchoWindow } from '../../persistence/index/EchoWindow';

/**
 * The vault collaborators every note-backed repository takes — constructed once at the
 * composition root and shared between them. The repositories never reach `app`
 * themselves.
 */
export interface NoteVaultDeps {
	readonly vault: Vault;
	readonly fileManager: FileManager;
	readonly metadataCache: MetadataCache;
	readonly index: ProjectIndex;
	readonly echo: EchoWindow;
	readonly migrations: MigrationRunner;
	/** Compensation failures are logged, never swallowed (SDD §42). */
	readonly logger: Logger;
	/** The one location setting (ADR-011); the user's raw string, normalized on use. */
	readonly projectFolder: string;
}

/** The stored schema version, or 0 when absent — where migration chains start. */
export function schemaVersionIn(raw: Record<string, unknown>, key = 'schema-version'): number {
	const value = raw[key];
	return typeof value === 'number' ? value : 0;
}

export function fileAt(vault: Vault, path: string | undefined): TFile | null {
	return path ? (vault.getAbstractFileByPath(path) as TFile | null) : null;
}
