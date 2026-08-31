import type { WorkspaceLeaf } from 'obsidian';
import { revealView } from './revealView';
import type { RevealDeps } from './reveal';

/**
 * A ticket and its write chain, kept together because they answer one question — "is this
 * still the latest navigation for THIS target" — and a ticket read from one object while its
 * chain lives in another could disagree about which target either belongs to.
 *
 * **Scoped per target, and that scoping is the whole fix for a defect two reviewers found
 * independently on this module's first version.** Before `targetLeaf` existed there was one
 * lane for the whole module, which was correct: every call resolved to the same singleton
 * leaf, so "the latest call wins" was right by construction. `targetLeaf` was added
 * specifically so two split panes navigate INDEPENDENTLY — and a single shared lane made that
 * false the moment two targets were in flight at once: a navigation issued for leaf A,
 * followed (before A's queued write ran) by an unrelated navigation for leaf B, bumped the one
 * shared ticket and made A's own check see itself as superseded. A's write was silently
 * dropped down the same path a legitimate supersession takes — `reportFault` is never called,
 * because nothing actually faulted — so the user's click in the first pane did nothing, with
 * no error anywhere to say why. One chain per target is what makes that check ask "superseded
 * BY THIS TARGET'S OWN LATER CALL" rather than "superseded by anything at all".
 */
interface NavigationChain {
	/**
	 * The latest navigation THIS lane was asked for — the per-target twin of what used to be a
	 * single module-scoped counter. Read and bumped exactly the way the old single counter was;
	 * only the SCOPE changed.
	 */
	ticket: number;
	/**
	 * This lane's writes, in issue order.
	 *
	 * The ticket alone is not enough, and the spec's own version stopped one step short. It is
	 * read once, before `setViewState`, so it can only drop a request that was superseded
	 * BEFORE its write began — the same-tick case. A request that passed the check and is
	 * mid-write when a later one arrives (for the SAME target) is not dropped and not ordered:
	 * both writes are in flight, and the earlier one can settle LAST and restore the project the
	 * user has already navigated away from. Reported by a review bot against this plan, and the
	 * window is real rather than theoretical: `setViewState` on a live leaf runs the registered
	 * factory and the view's `onOpen`, which mounts a Vue app and issues a query.
	 *
	 * Chaining makes "the latest request for this target wins" true of the WRITES rather than
	 * of the intentions: the earlier write completes first because it was queued first, and the
	 * later one lands on top of it. The ticket check stays, INSIDE the chained step, because it
	 * is still what stops a superseded request writing at all — a chain alone would remount to
	 * the first project and then to the second, which is the flicker the ticket exists to avoid.
	 */
	writes: Promise<void>;
}

function freshChain(): NavigationChain {
	return { ticket: 0, writes: Promise.resolve() };
}

/**
 * The command palette's own lane: navigation with no originating leaf, which has no `Object`
 * to key a per-target lane on. A plain object rather than a `Symbol` — this repository's `lib`
 * target (`ES2020` plus a few named additions, no `ES2023.Collection`) does not admit a symbol
 * as a `WeakMap` key, and an ordinary object needs nothing more than identity.
 *
 * Held in `chains` exactly like a real leaf, referenced permanently by this module-level
 * constant — so, unlike a leaf's own entry, it can never become collectible and behaves as the
 * single persistent lane every no-`targetLeaf` call shared before per-target scoping existed.
 */
const PALETTE_LANE: object = {};

/**
 * One chain per navigation target, `PALETTE_LANE` standing in for "no leaf" — a `WeakMap`
 * rather than a `Map`, and that is a decision rather than a default.
 *
 * A `WorkspaceLeaf` is a real Obsidian object the user can close, and a plain `Map` would hold
 * a strong reference to every leaf this module has ever navigated for the life of the plugin —
 * a closed leaf's chain (and the closed leaf itself, kept alive only by being a Map key) would
 * leak for the rest of the session. A `WeakMap` lets a closed leaf's entry go with it: once
 * nothing else references that leaf, this map cannot either, and there is nothing to lose by
 * letting the entry go, because a closed leaf can never source another navigation request —
 * nothing will ever look this entry up again. `PALETTE_LANE` is the one key that is meant to
 * live forever, and it does, for the reason its own comment gives.
 *
 * Module state, and reset only implicitly by the tests that need isolation
 * (`vi.resetModules()` in a `beforeEach`) rather than by a test-only export — `activating` in
 * `reveal.ts` carries the same hazard and the same choice: neither module exposes a reset door,
 * and every case here either drives a fresh chain through a re-imported module or is written so
 * a chain's absolute ticket value does not matter, only its ordering relative to the calls
 * inside that one test.
 */
const chains = new WeakMap<object, NavigationChain>();

/** This target's chain, creating one on first use. */
function chainFor(targetLeaf: WorkspaceLeaf | undefined): NavigationChain {
	const key: object = targetLeaf ?? PALETTE_LANE;
	const existing = chains.get(key);
	if (existing !== undefined) return existing;
	const chain = freshChain();
	chains.set(key, chain);
	return chain;
}

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
 * **And "the later call" now means the later call FOR THIS TARGET** — see `NavigationChain`'s
 * own comment for the defect that scoping closes.
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
	// originating leaf — falls back to the type lookup exactly as before, and shares
	// `PALETTE_LANE`'s own chain rather than a per-leaf one.
	targetLeaf?: WorkspaceLeaf,
): Promise<void> {
	const chain = chainFor(targetLeaf);
	const ticket = ++chain.ticket;
	// A target leaf is already the one the user is looking at — it is where the gesture that
	// asked for this navigation came from — so there is nothing to REVEAL: no candidate lookup
	// to run and no leaf to create. Revealing anyway would risk activating a different leaf of
	// the same type (the type lookup below is exactly the ambiguity a split pane introduces)
	// while claiming to have shown the one already on screen.
	if (targetLeaf === undefined && !(await revealView(deps, type))) return;

	chain.writes = chain.writes.then(async () => {
		// The `try` wraps the WHOLE step, not just the write, and both halves of that matter.
		//
		// `getLeavesOfType` is a synchronous call into Obsidian that can throw, and
		// `revealCandidate` next door already treats exactly that as a real workspace fault —
		// its own comment records the round where a candidate lookup "sat one call out" and
		// escaped the boundary. A throw here would leave this helper rejecting with nothing
		// reported, which is the contract every door in this directory keeps.
		//
		// And the second consequence is worse than the first: an uncaught throw settles this
		// CHAIN's `writes` REJECTED, and a rejected promise makes every later `.then(step)` on
		// that same chain skip its callback — so one bad lookup would kill navigation for this
		// one target for the rest of the session, silently, while every other target's chain is
		// unaffected. Catching inside the callback is what makes the stored promise always
		// FULFIL, so the chain recovers by construction rather than by anyone remembering to
		// reset it. Reported by a review bot against this plan.
		try {
			// Read INSIDE the chain, not before it: a request superseded — by a LATER call to
			// this same target — while it waited its turn must not write at all, and by here
			// this chain's ticket reflects everything that has arrived for this target.
			if (ticket !== chain.ticket) return;
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
	await chain.writes;
}
