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
 * What a click on a project row DID, so the caller can tell "it opened" from "that row
 * points at nothing any more".
 *
 * `'missing'` is the whole reason this is not `void`. It is returned for both of the two
 * ways a resolution comes up empty — no index entry, and an index entry whose path is not
 * a file — because they are the same fact to the caller, and the caller is the only layer
 * that can act on it: `infrastructure/` may not reach the store holding the list, nor
 * `presentation/notices/`.
 */
export type ProjectNoteOpenOutcome = 'opened' | 'missing';

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
 * **It ANSWERS when the id resolves to nothing rather than returning silently**, and the
 * paragraph that used to sit here said the opposite: "the list is re-read on the next hydrate
 * anyway". There was no next hydrate. `RenovationProjectStore.hydrate` has exactly two callers
 * — the view's `onMounted` and `ViewRoot.onCreateProject` — and neither is reached by a
 * deletion: `VaultChangeAdapter` drops the index entry without publishing anything, so a
 * project note deleted after the pane was opened left a row that stayed on screen, did nothing
 * when clicked, and told the user nothing until the view was reopened. Reported in review.
 *
 * So the click itself is the trigger: `'missing'` travels back to `ViewRoot`, which re-reads
 * the list, and the stale row disappears. That is the whole feedback, deliberately — the row
 * going away IS the answer to "why did nothing open", and it is the same answer a notice would
 * have given with an extra dismissal on top.
 */
export async function openProjectNote(
	deps: { readonly workspace: Workspace; readonly vault: Vault; readonly index: ProjectIndex },
	projectId: string,
): Promise<ProjectNoteOpenOutcome> {
	// `ProjectIndex.getPath` takes a branded `EntityId`, not a bare string — the cast
	// `projectFolderOf` and `buildProjectIndexEntries` take at this same boundary, since a
	// `ProjectSummaryDto.id` (what this is always called with) carries no brand at all.
	const path = deps.index.getPath(projectId as EntityId<string>);
	if (path === undefined) return 'missing';
	const file = deps.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile)) return 'missing';
	const existing = deps.workspace
		.getLeavesOfType(MARKDOWN_VIEW)
		.find((leaf) => filePathOf(leaf) === file.path);
	if (existing !== undefined) {
		await deps.workspace.revealLeaf(existing);
		return 'opened';
	}
	await deps.workspace.getLeaf('tab').openFile(file);
	return 'opened';
}
