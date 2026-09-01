import type { WorkspaceLeaf } from 'obsidian';
import { revealCandidate, type RevealDeps } from './reveal';

/**
 * Read through the LEAF's own view state rather than through `leaf.view`, for
 * `revealPlanEditor`'s reason: the leaf is what Obsidian persists and restores, so it has an
 * answer even for a leaf whose view has been deferred and not constructed yet — exactly the
 * case a vault reopened onto two Asset Designers produces.
 */
function assetIdOf(leaf: WorkspaceLeaf): string | undefined {
	const state = leaf.getViewState().state;
	const assetId = state?.['assetId'];
	return typeof assetId === 'string' ? assetId : undefined;
}

/**
 * Show the Asset Designer for ONE specific Asset, reusing the leaf already showing it.
 *
 * The sibling of `revealPlanEditor` in every respect but the field it matches on — ADR-0015's
 * designer is per-asset for the reason the Plan Editor is per-plan: comparing two objects
 * means having both open. Both functions share their mechanism through `revealCandidate`,
 * which is what CLAUDE.md's "one action, every input" rule actually asks for: the number of
 * DECIDERS per action, not the number of functions in a module.
 *
 * The view type is a STRING here for the reason `revealPlanEditor` states: `infrastructure/`
 * may not reach `presentation/`, and the composition root knows which view it is wiring.
 *
 * It does not REJECT, for the reason `revealPlanEditor` gives: the fault is answered inside
 * the coalescer, once per activation.
 */
export async function revealAssetDesigner(
	deps: RevealDeps,
	viewType: string,
	assetId: string,
): Promise<void> {
	// A thunk, so the lookup and every `assetIdOf` read happen INSIDE `revealCandidate`'s fault
	// boundary — `revealPlanEditor`'s own comment states why a throw here must not escape as an
	// enumerated candidate list built outside it.
	await revealCandidate(
		deps,
		viewType,
		() => deps.workspace.getLeavesOfType(viewType).filter((leaf) => assetIdOf(leaf) === assetId),
		{ assetId },
	);
}
