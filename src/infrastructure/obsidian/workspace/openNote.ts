import { normalizePath, TFile, type Vault, type Workspace } from 'obsidian';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';

/**
 * Opens the note a project's id resolves to.
 *
 * The path comes from the Project Index — the same lookup `getById` and `delete` take — and
 * never from a convention: since ADR-0013 a project's folder is wherever its note currently
 * sits, and the file is not reliably named `Project.md`.
 *
 * Silent when the id resolves to nothing. That is not a swallowed error: the only way to hold
 * a stale id here is a note deleted since the list was read, and the list is re-read on the
 * next hydrate anyway. A notice would describe a race the user cannot act on.
 */
export async function openProjectNote(
	deps: { readonly workspace: Workspace; readonly vault: Vault; readonly index: ProjectIndex },
	projectId: string,
): Promise<void> {
	// `ProjectIndex.getPath` takes a branded `EntityId`, not a bare string — the cast
	// `projectFolderOf` and `buildProjectIndexEntries` take at this same boundary, since a
	// `ProjectSummaryDto.id` (what this is always called with) carries no brand at all.
	const path = deps.index.getPath(projectId as EntityId<string>);
	if (path === undefined) return;
	const file = deps.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return;
	await deps.workspace.getLeaf('tab').openFile(file);
}
