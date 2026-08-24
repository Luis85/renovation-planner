import type { Workspace, WorkspaceLeaf } from 'obsidian';
import { revealCandidate } from './reveal';

/**
 * Read through the LEAF's own view state rather than through `leaf.view`: the leaf is what
 * Obsidian persists and restores, so it has an answer even for a leaf whose view has been
 * deferred and not constructed yet — which is exactly the case a vault reopened onto two
 * Plan Editors produces.
 */
function planIdOf(leaf: WorkspaceLeaf): string | undefined {
	const state = leaf.getViewState().state;
	const planId = state?.['planId'];
	return typeof planId === 'string' ? planId : undefined;
}

/**
 * Show the Plan Editor for ONE specific Plan, reusing the leaf already showing it.
 *
 * A second function beside `revealView`, and CLAUDE.md's "one action, every input" rule is
 * what makes that need justifying rather than assuming. The rule's target is two entry
 * points that each DECIDE what opening means — a ribbon and a command with their own
 * activation, opening a duplicate tab the moment a user uses both. That is about the
 * number of deciders per action, not the number of functions in a module: every way of
 * opening a Plan Editor still lands on exactly this one, and both functions share their
 * mechanism through `revealCandidate`.
 *
 * *Generalizing `revealView` with a matcher* was the alternative and it is refused on what
 * `revealView` can see: it matches with `getLeavesOfType(type)` and nothing else, whereas
 * matching a Plan means reading each candidate leaf's own state. A `revealView(workspace,
 * type, match?)` would make every caller of the singleton case pay for a parameter only
 * one caller can supply, and would branch on whether a matcher was given.
 *
 * The view type is a STRING here for the reason `revealView` states: `infrastructure/` may
 * not reach `presentation/`, and the composition root knows which view it is wiring.
 */
export async function revealPlanEditor(
	workspace: Workspace,
	viewType: string,
	planId: string,
): Promise<void> {
	const candidates = workspace
		.getLeavesOfType(viewType)
		.filter((leaf) => planIdOf(leaf) === planId);
	await revealCandidate(workspace, viewType, candidates, { planId });
}
