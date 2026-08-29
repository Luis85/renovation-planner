import { revealCandidate, type RevealDeps } from './reveal';

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
 *
 * It does not REJECT: `revealCandidate` answers every fault through `deps.reportFault`, once
 * per activation rather than once per click. So a caller has nothing left to catch, which is
 * why the two detached doors hand this straight to `void` rather than to `runDetached`.
 */
export function revealView(deps: RevealDeps, type: string): Promise<void> {
	// Every leaf of the type is a candidate, which is what makes this the SINGLETON case:
	// there is at most one, and the first is it. `revealPlanEditor` is the same mechanism
	// over a narrower candidate set — see `revealCandidate`.
	return revealCandidate(deps, type, () => deps.workspace.getLeavesOfType(type));
}
