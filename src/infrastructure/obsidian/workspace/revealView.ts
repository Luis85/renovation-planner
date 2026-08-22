import type { Workspace } from 'obsidian';

/**
 * Show the view of `type`, reusing the leaf it is already in.
 *
 * Every way in — a ribbon click, a command, and whatever a future toolbar adds — lands
 * here, so "one leaf, revealed" is decided in one place rather than re-decided per entry
 * point. Opening a second tab of the same view on every click is the defect this exists to
 * prevent, and it is the one every hand-rolled activation grows.
 *
 * It takes the view type as a STRING rather than importing it: `infrastructure/` may not
 * reach `presentation/` (the SDD's dependency rule, enforced in `eslint.config.mjs`), and
 * the composition root is what knows which view it is wiring.
 *
 * `setViewState` only on a leaf this call created — setting it on an existing leaf would
 * rebuild a view the user has already scrolled and filtered.
 */
export async function revealView(workspace: Workspace, type: string): Promise<void> {
	const open = workspace.getLeavesOfType(type);
	const leaf = open[0] ?? workspace.getLeaf('tab');
	if (open.length === 0) await leaf.setViewState({ type, active: true });
	await workspace.revealLeaf(leaf);
}
