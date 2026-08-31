import type { WorkspaceLeaf } from 'obsidian';
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
 *
 * **It ANSWERS the leaf it revealed**, and that is the SECOND widening of this signature —
 * `void`, then `boolean`, now the leaf. The first widening's argument still holds and is not
 * enough: leaf EXISTENCE cannot say whether the activation succeeded, because `revealCandidate`
 * wraps `await deps.workspace.revealLeaf(existing)` in its own fault boundary and RESOLVES
 * after reporting — `revealView.test.ts`'s "answers a fault on the reuse path too" pins exactly
 * that — so a failed reveal of an EXISTING leaf leaves that leaf sitting in `getLeavesOfType`,
 * and the reuse path is the NORMAL one for a singleton view.
 *
 * What the BOOLEAN could not say is WHICH leaf, and that is the defect this widening closes.
 * `navigateToProject` had to re-derive it — `getLeavesOfType(type)[0]`, a fresh lookup made
 * after the `await` — and **a value re-derived after an `await` is a value that may have
 * changed**: the revealed pane closed, or the leaves reordered, and the palette command
 * revealed one pane and wrote the project state into another. `revealCandidate` was holding
 * that leaf the whole time and discarding it to answer `true`; answering it instead is
 * strictly more information at every call site, and `undefined` carries everything `false`
 * carried plus the fact that there is no leaf on offer to write into.
 *
 * Additive rather than the widening decision 6 refused: this is a RETURN VALUE, not a
 * parameter whose two callers want opposite answers. Both detached doors `void` the call and
 * are unaffected.
 */
export function revealView(deps: RevealDeps, type: string): Promise<WorkspaceLeaf | undefined> {
	// Every leaf of the type is a candidate, which is what makes this the SINGLETON case:
	// there is at most one, and the first is it. `revealPlanEditor` is the same mechanism
	// over a narrower candidate set — see `revealCandidate`.
	return revealCandidate(deps, type, () => deps.workspace.getLeavesOfType(type));
}
