import { normalizePath, TFile, type Vault, type Workspace, type WorkspaceLeaf } from 'obsidian';
import type { EntityId } from '../../../core/identity/EntityId';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';

/** Obsidian's own view type for a note. A string for the reason every view type here is one. */
const MARKDOWN_VIEW = 'markdown';

/**
 * Which file a leaf is showing, read through the LEAF's own view state rather than through
 * `leaf.view.file` — the same choice `revealPlanEditor.planIdOf` makes and for the same
 * reason: the leaf is what Obsidian persists and restores, so it has an answer even for a
 * leaf whose view has been deferred and not constructed yet, which is exactly what a vault
 * reopened onto several note tabs produces.
 */
function filePathOf(leaf: WorkspaceLeaf): string | undefined {
	const file = leaf.getViewState().state?.['file'];
	return typeof file === 'string' ? file : undefined;
}

/**
 * Opens the note a project's id resolves to, REUSING the tab it is already open in.
 *
 * The path comes from the Project Index — the same lookup `getById` and `delete` take — and
 * never from a convention: since ADR-0013 a project's folder is wherever its note currently
 * sits, and the file is not reliably named `Project.md`.
 *
 * **Reuse is keyed on the FILE, not on "a markdown leaf exists".** A project row is a control
 * a user clicks repeatedly, so an unconditional `getLeaf('tab')` gave N clicks on one row N
 * identical tabs — the defect `revealView`'s own docblock names as the one every hand-rolled
 * activation grows, and this module was the hand-rolled one. Keying on the file is also what
 * keeps a SECOND project opening in its own tab rather than taking over the first.
 *
 * An existing leaf is REVEALED and never re-opened, which is `revealCandidate`'s rule applied
 * here: the file is already in that leaf, and `openFile` on it would rebuild a view the user
 * may have scrolled. It cannot share that helper, though — `revealCandidate` establishes a
 * view with `setViewState`, and a note is established by `openFile`, which is what carries
 * Obsidian's own file-opening behaviour.
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
	const existing = deps.workspace
		.getLeavesOfType(MARKDOWN_VIEW)
		.find((leaf) => filePathOf(leaf) === file.path);
	if (existing !== undefined) {
		await deps.workspace.revealLeaf(existing);
		return;
	}
	await deps.workspace.getLeaf('tab').openFile(file);
}
