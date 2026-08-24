import type { Workspace, WorkspaceLeaf } from 'obsidian';

/**
 * The mechanism both activations share: find candidates, take the first or create one,
 * `setViewState` ONLY on a leaf this call created, then reveal.
 *
 * Factored out rather than duplicated because the middle step is the subtle one —
 * setting the view state on an EXISTING leaf rebuilds a view the user has already
 * scrolled, filtered or panned — and a subtlety re-remembered per function is one that
 * eventually is not.
 *
 * The CANDIDATES are the caller's to decide, and that is the whole difference between the
 * two: `revealView` guarantees one leaf per view type, and the Plan Editor's premise is
 * that several coexist. One function that both guaranteed uniqueness and permitted
 * multiplicity would guarantee nothing.
 */
export async function revealCandidate(
	workspace: Workspace,
	type: string,
	candidates: readonly WorkspaceLeaf[],
	state?: Record<string, unknown>,
): Promise<void> {
	const existing = candidates[0];
	const leaf = existing ?? workspace.getLeaf('tab');
	if (existing === undefined) await leaf.setViewState({ type, active: true, state });
	await workspace.revealLeaf(leaf);
}
