import type { WorkspaceLeaf } from 'obsidian';
import { revealView } from './revealView';
import type { RevealDeps } from './reveal';

/**
 * The latest navigation this module was asked for. Module-scoped beside the helper, for the
 * reason the coalescing map next door is: a subtlety re-remembered per caller is one that
 * eventually is not.
 *
 * Module state, and reset only implicitly by the tests that need isolation
 * (`vi.resetModules()` in a `beforeEach`) rather than by a test-only export — `activating` in
 * `reveal.ts` carries the same hazard and the same choice: neither module exposes a reset
 * door, and every case here either drives a fresh `latestNavigation`/`navigationWrites` pair
 * through a re-imported module or is written so the counter's absolute value does not matter,
 * only its ordering relative to the calls inside that one test.
 */
let latestNavigation = 0;

/**
 * The writes themselves, in issue order.
 *
 * The ticket alone is not enough, and the spec's own version stopped one step short. It is
 * read once, before `setViewState`, so it can only drop a request that was superseded BEFORE
 * its write began — the same-tick case. A request that passed the check and is mid-write when
 * a later one arrives is not dropped and not ordered: both writes are in flight, and the
 * earlier one can settle LAST and restore the project the user has already navigated away
 * from. Reported by a review bot against this plan, and the window is real rather than
 * theoretical: `setViewState` on a live leaf runs the registered factory and the view's
 * `onOpen`, which mounts a Vue app and issues a query.
 *
 * Chaining makes "the latest request wins" true of the WRITES rather than of the intentions:
 * the earlier write completes first because it was queued first, and the later one lands on
 * top of it. The ticket check stays, INSIDE the chained step, because it is still what stops
 * a superseded request writing at all — a chain alone would remount to the first project and
 * then to the second, which is the flicker the ticket exists to avoid.
 */
let navigationWrites: Promise<void> = Promise.resolve();

/**
 * Reveal the singleton view, then navigate it to a project — design slice 21's two steps, in
 * the order they mean. Given `targetLeaf`, the reveal is skipped and the write goes straight
 * to that leaf: see the parameter's own comment for why "the singleton" stops being a safe
 * description of `getLeavesOfType(type)[0]` the moment a split pane exists.
 *
 * **Why not one call.** `revealView` takes no `state`, and `revealCandidate` sets state only
 * on a leaf it CREATED (deliberately: setting it on an existing leaf "rebuilds a view the user
 * has already scrolled, filtered or panned"). The NORMAL case here is a leaf that is already
 * open, so a state passed through would have been ignored and the user left where they were.
 * And `requestKey` is the type plus the serialized state, which for a SINGLETON is the wrong
 * key — two invocations naming different projects produce two keys, neither joins the other,
 * an in-flight leaf does not answer `getLeavesOfType` yet, and both create one. The key
 * describes the REQUEST where the guard needs to describe the LEAF.
 *
 * **Uniqueness falls out**: `revealView`'s existing coalescing is keyed on the type alone,
 * because that call carries no state, so two invocations in one tick produce one leaf whether
 * they name the same project or different ones.
 *
 * **Ordering does NOT fall out**, and a sentence claiming it did was the spec's own repaired
 * finding: both calls await the SAME coalesced promise, resume in the same tick, and then
 * issue `setViewState` concurrently — the earlier one can settle last and win. The ticket is
 * what decides. Superseded calls DROP their write rather than queueing behind it, which is the
 * difference between a ticket and a chain and is the right one here: a user who picked twice
 * wants the second project, not a remount to the first followed by a remount to the second.
 *
 * It lives in `infrastructure/obsidian/workspace/` beside its siblings, because `plugin/`
 * composing the two steps for itself would be the second activation path decision 6 refuses —
 * and because `reportFault` is already a member of `RevealDeps`.
 */
export async function navigateToProject(
	deps: RevealDeps,
	type: string,
	projectId: string | null,
	// The leaf navigation was raised FROM, when there is one — a row click or Back inside an
	// already-visible pane. `getLeavesOfType(type)[0]` is "the first leaf of this type", which
	// is only ever the right target while the view is a singleton BY CONSTRUCTION; Obsidian's
	// own split action duplicates a leaf with its view state intact, so a vault with the pane
	// split genuinely has two. Writing to the first one regardless would let a click in the
	// SECOND pane silently retarget the first, leaving the pane the user actually clicked in
	// showing its stale state. Absent — the command palette's case, where there is no
	// originating leaf — falls back to the type lookup exactly as before.
	targetLeaf?: WorkspaceLeaf,
): Promise<void> {
	const ticket = ++latestNavigation;
	// A target leaf is already the one the user is looking at — it is where the gesture that
	// asked for this navigation came from — so there is nothing to REVEAL: no candidate lookup
	// to run and no leaf to create. Revealing anyway would risk activating a different leaf of
	// the same type (the type lookup below is exactly the ambiguity a split pane introduces)
	// while claiming to have shown the one already on screen.
	if (targetLeaf === undefined && !(await revealView(deps, type))) return;

	navigationWrites = navigationWrites.then(async () => {
		// The `try` wraps the WHOLE step, not just the write, and both halves of that matter.
		//
		// `getLeavesOfType` is a synchronous call into Obsidian that can throw, and
		// `revealCandidate` next door already treats exactly that as a real workspace fault —
		// its own comment records the round where a candidate lookup "sat one call out" and
		// escaped the boundary. A throw here would leave this helper rejecting with nothing
		// reported, which is the contract every door in this directory keeps.
		//
		// And the second consequence is worse than the first: an uncaught throw settles
		// `navigationWrites` REJECTED, and a rejected promise makes every later
		// `.then(step)` skip its callback — so one bad lookup would kill project navigation
		// for the rest of the session, silently. Catching inside the callback is what makes
		// the stored promise always FULFIL, so the chain recovers by construction rather than
		// by anyone remembering to reset it. Reported by a review bot against this plan.
		try {
			// Read INSIDE the chain, not before it: a request superseded while it waited its
			// turn must not write at all, and by here the counter reflects everything that
			// has arrived.
			if (ticket !== latestNavigation) return;
			// A given target skips the type lookup entirely, not only the reveal above: it
			// names the exact leaf to write to, and asking `getLeavesOfType` again could answer
			// a DIFFERENT one of two split leaves of the same type.
			const leaf = targetLeaf ?? deps.workspace.getLeavesOfType(type)[0];
			// The case the boolean does not cover: a successful activation whose leaf has
			// since gone, and the create path having produced none.
			if (leaf === undefined) return;
			await leaf.setViewState({ type, active: true, state: { projectId: projectId ?? '' } });
			return;
		} catch (cause) {
			// This step sits OUTSIDE `revealView`'s boundary, whose contract is that it does
			// not reject — which is why its two detached callers hand it to `void` rather than
			// to `runDetached`.
			deps.reportFault(cause);
			return;
		}
	});
	await navigationWrites;
}
