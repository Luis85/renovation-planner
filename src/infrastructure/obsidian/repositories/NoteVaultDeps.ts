import { TFile, type FileManager, type MetadataCache, type Vault } from 'obsidian';
import type { Logger } from '../../../application/ports/Logger';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import type { DiagnosticsLedger } from '../../../application/ports/diagnostics';
import type { MigrationRunner } from '../../persistence/migration/MigrationRunner';
import type { EchoWindow } from '../../persistence/index/EchoWindow';

/**
 * The vault collaborators every note-backed repository takes — constructed once at the
 * composition root and shared between them. The repositories never reach `app`
 * themselves.
 *
 * A project's folder is deliberately NOT among them. It used to be (`projectFolder`, the
 * plugin setting, normalized once in each repository's constructor), and that was a lost
 * update waiting to happen: five repositories cached the SAME string, so a project's note
 * moving to a different folder — a rename, a manual reorganisation in the vault — left
 * every one of them writing new notes into a folder no project's note actually sat in
 * anymore. Under ADR-0013 a project's folder is DERIVED, the folder its own note sits in
 * (`projectFolderOf`, resolved through the index), and a derived value cannot be a
 * constructor field — it has to be read fresh at the point each save needs it, which is
 * what made a per-project field a build failure rather than a convention the moment this
 * one was deleted.
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
	/** Read refusals land here (opaque id + error code only), for SDD §68's snapshot. */
	readonly ledger: DiagnosticsLedger;
}

/**
 * Narrows with `instanceof TFile`, like every sibling call site (`openNoteById` in
 * `noteIo.ts`) — a cast here used to be indistinguishable from the narrow, because nothing
 * in the suite could make `getAbstractFileByPath` answer anything but a file or `null`.
 * `FakeVault`'s folder-resolving widening (design slice 18, task 5) made the gap real: a
 * path that resolves to a FOLDER — which cannot happen through the index today, since
 * nothing upserts a project's own path as a folder, but is exactly the shape ADR-0013
 * makes possible one level up — must answer `null` here rather than a `TFolder` wearing a
 * `TFile` cast, or every caller of `locate`/`fileAt` would call file-only operations
 * (`frontmatterOf`, `vault.read`, `trashFile`) on an object that is not one.
 */
export function fileAt(vault: Vault, path: string | undefined): TFile | null {
	if (!path) return null;
	const found = vault.getAbstractFileByPath(path);
	return found instanceof TFile ? found : null;
}
