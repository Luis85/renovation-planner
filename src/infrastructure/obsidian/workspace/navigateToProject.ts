import type { WorkspaceLeaf } from 'obsidian';
import { revealView } from './revealView';
import type { RevealDeps } from './reveal';

/**
 * A ticket and its write chain, kept together because they answer one question — "is this
 * still the latest navigation for THIS leaf" — and a ticket read from one object while its
 * chain lives in another could disagree about which leaf either belongs to.
 *
 * **Scoped per LEAF, and getting that scope right took three goes, each fix creating the
 * next.** The chain is worth reading as that sequence rather than as a static design:
 *
 * 1. **One module-wide lane.** Correct while the view was a singleton by construction: every
 *    call resolved to the same leaf, so "the latest call wins" was right for the whole module.
 * 2. **`targetLeaf` made two split panes navigate INDEPENDENTLY, and the single lane became
 *    cross-target ticket contamination.** A navigation issued for leaf A, followed (before A's
 *    queued write ran) by an unrelated navigation for leaf B, bumped the one shared ticket and
 *    made A's own check see itself as superseded. A's write was silently dropped down the same
 *    path a legitimate supersession takes — `reportFault` is never called, because nothing
 *    actually faulted — so the user's click in the first pane did nothing, with no error
 *    anywhere to say why. Found independently by two reviewers.
 * 3. **Per-target lanes fixed that and left the palette's lane blind to the leaf it resolves
 *    to.** A call with no `targetLeaf` was keyed on a module-level sentinel object, while an
 *    in-view call naming the very leaf that call reveals was keyed on the leaf — two lanes for
 *    one physical pane, and two lanes are not serialized against each other. So a palette
 *    navigation mid-write, plus a row click or Back in that same pane, issued concurrent
 *    `setViewState` calls, and the earlier palette write could settle LAST and overwrite the
 *    user's later, in-pane choice. Neither the ticket nor the chain could see the other lane.
 *
 * The lane is therefore keyed on the leaf a call actually RESOLVES to, never on how the call
 * was raised — which is why `navigateToProject` resolves its leaf first and queues second, and
 * why there is no sentinel key any more. Every key in `chains` is a real `WorkspaceLeaf`, so
 * two calls share a lane exactly when they would write to the same pane, which is the only
 * thing "supersedes" and "queues behind" have ever meant here.
 */
interface NavigationChain {
	/**
	 * The highest ISSUE NUMBER any call that resolved to this lane has been given — see
	 * `issued` for why the number is taken at arrival and only compared within a lane. Raised
	 * with a MAX rather than an increment, because a call's issue number is fixed before its
	 * lane is known: two calls can join this lane in the opposite order to the one they arrived
	 * in, and the earlier arrival must not be able to lower what the later one recorded.
	 */
	ticket: number;
	/**
	 * This lane's writes, in the order they joined it.
	 *
	 * The ticket alone is not enough, and the spec's own version stopped one step short. It is
	 * read once, before `setViewState`, so it can only drop a request that was superseded
	 * BEFORE its write began — the same-tick case. A request that passed the check and is
	 * mid-write when a later one arrives (for the SAME leaf) is not dropped and not ordered:
	 * both writes are in flight, and the earlier one can settle LAST and restore the project the
	 * user has already navigated away from. Reported by a review bot against this plan, and the
	 * window is real rather than theoretical: `setViewState` on a live leaf runs the registered
	 * factory and the view's `onOpen`, which mounts a Vue app and issues a query.
	 *
	 * Chaining makes "the latest request for this leaf wins" true of the WRITES rather than
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
 * One chain per leaf navigated — a `WeakMap` rather than a `Map`, and that is a decision
 * rather than a default.
 *
 * A `WorkspaceLeaf` is a real Obsidian object the user can close, and a plain `Map` would hold
 * a strong reference to every leaf this module has ever navigated for the life of the plugin —
 * a closed leaf's chain (and the closed leaf itself, kept alive only by being a Map key) would
 * leak for the rest of the session. A `WeakMap` lets a closed leaf's entry go with it: once
 * nothing else references that leaf, this map cannot either, and there is nothing to lose by
 * letting the entry go, because a closed leaf can never source another navigation request —
 * nothing will ever look this entry up again. Every key is a leaf, so there is no entry here
 * that is meant to outlive the pane it describes.
 *
 * Module state, and reset only implicitly by the tests that need isolation
 * (`vi.resetModules()` in a `beforeEach`) rather than by a test-only export — `issued` below
 * and `activating` in `reveal.ts` carry the same hazard and the same choice: no module exposes
 * a reset door, and every case here either drives a fresh chain through a re-imported module or
 * is written so a chain's absolute ticket value does not matter, only its ordering relative to
 * the calls inside that one test.
 */
const chains = new WeakMap<WorkspaceLeaf, NavigationChain>();

/** This leaf's chain, creating one on first use. */
function chainFor(leaf: WorkspaceLeaf): NavigationChain {
	const existing = chains.get(leaf);
	if (existing !== undefined) return existing;
	const chain = freshChain();
	chains.set(leaf, chain);
	return chain;
}

/**
 * Issue numbers, taken at ARRIVAL and shared by every lane — which is where supersession order
 * is fixed, and it is a decision rather than a leftover.
 *
 * The lane cannot be chosen until the leaf is known, and for a palette call the leaf is only
 * known after the reveal resolves. So a per-lane counter would have to be bumped after that
 * `await`, making supersession order RESUME order — and resume order is NOT arrival order. Two
 * ways it is not, and only the second is subtle:
 *
 * - `revealCandidate` coalesces its CREATE path alone. Revealing a leaf that is ALREADY open —
 *   the normal case for a singleton view — is an ordinary `await revealLeaf(...)` per call, and
 *   two of those settle in whatever order the workspace finishes them. Nothing orders them, and
 *   the real call activates a tab and may expand a collapsed sidebar to do it.
 * - Two calls that DO join one coalesced activation resume in the order their reactions were
 *   attached, which is arrival order today by construction rather than by any promise the
 *   platform makes — and stops being arrival order the moment one of the two paths through
 *   `revealCandidate` grows a microtask hop the other does not have.
 *
 * Under a per-lane increment, an inverted resume hands the LOWER ticket to the call the user
 * made SECOND and writes the project they had just navigated away from — the exact defect the
 * ticket exists to prevent, arrived at from the other side. Measured rather than argued: the
 * suite's 'ends on the later-issued project when an earlier call reveals more slowly' drives the
 * first of those two ways, and is red both against that design and against a plain
 * `chain.ticket = issue` in place of the MAX.
 *
 * A single monotonic counter read before the first `await` makes the order a fact about when
 * each call was asked for, which is what "the latest navigation" has always meant here and what
 * it meant before the reveal moved. Sharing one counter across lanes costs nothing, because an
 * issue number is only ever COMPARED against the ticket of the one lane its own call resolved
 * to: another lane's call raises this number without touching that lane's ticket, so the
 * cross-target contamination step 2 of `NavigationChain`'s history describes cannot come back
 * through it.
 */
let issued = 0;

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
 * **The two steps that make that work are taken at different moments, on purpose.** The issue
 * number is taken at ARRIVAL, before any `await`, so "which call is later" is decided by when
 * the user asked; the LANE is chosen once the leaf is known, so a palette call and an in-view
 * call naming the same pane are the same lane and can supersede and serialize against each
 * other. See `issued` for the first and `NavigationChain` for the second.
 *
 * A resolved leaf is held across the queue wait, which is what the `targetLeaf` path has always
 * done and is now what both paths do rather than one per path. If the user closes that pane
 * while this write is queued, the write lands on a detached leaf — and that is STATED rather
 * than bounded: the ticket does not save it, since a lone latest call is superseded by nothing,
 * and re-reading `getLeavesOfType` at write time would answer a DIFFERENT pane of the same type,
 * which is the ambiguity `targetLeaf` exists to refuse. What answers it is the step's own
 * boundary below, which reports whatever `setViewState` does about a leaf that is gone.
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
	// originating leaf — the type lookup answers, exactly as before, and the leaf it answers
	// is what picks the lane: an in-view call naming that same leaf shares it.
	targetLeaf?: WorkspaceLeaf,
	section?: 'details' | 'prices',
): Promise<void> {
	// Before the first `await`, so this is arrival order and not resume order.
	const issue = ++issued;
	// A target leaf is already the one the user is looking at — it is where the gesture that
	// asked for this navigation came from — so there is nothing to REVEAL: no candidate lookup
	// to run and no leaf to create. Revealing anyway would risk activating a different leaf of
	// the same type (the type lookup is exactly the ambiguity a split pane introduces) while
	// claiming to have shown the one already on screen. `??` short-circuits, so that path does
	// not reveal at all and never suspends here.
	//
	// **Otherwise the leaf is the one `revealView` ANSWERED, never a fresh lookup**, and that is
	// the fourth instalment of one shape in this module: a value re-derived after an `await` is
	// a value that may have changed. This used to be `if (!(await revealView(...))) return` in a
	// helper, followed by `getLeavesOfType(type)[0]` — so the leaf actually revealed was thrown
	// away and the workspace asked again, and if it had moved during that `await` (the revealed
	// pane closed, the leaves reordered) the fresh `[0]` answered a DIFFERENT leaf: the palette
	// command revealed one pane and wrote the project state into another. `revealCandidate` has
	// held that leaf since before its own first `await` and hands it back now.
	//
	// `undefined` means there is nothing to navigate, and both ways that happens are already
	// ANSWERED where they happen, which is why nothing is reported here: the reveal itself
	// faulted, or the candidate lookup THREW — `getLeavesOfType` is a synchronous call into
	// Obsidian that can throw, and it is a thunk called INSIDE `revealCandidate`'s own fault
	// boundary, which that function's `catch` records as the round where the lookup "sat one
	// call out" and escaped. Either way `deps.reportFault` has already run, once per activation
	// rather than once per joined click, so reporting again here would double it. The third way
	// the old shape had — the reveal succeeding and answering no leaf — has stopped existing
	// rather than moved: every success path of `revealCandidate` IS a leaf.
	const leaf = targetLeaf ?? (await revealView(deps, type));
	if (leaf === undefined) return;

	const chain = chainFor(leaf);
	chain.ticket = Math.max(chain.ticket, issue);
	chain.writes = chain.writes.then(async () => {
		// The stored promise must always FULFIL. An uncaught throw here settles this lane's
		// `writes` REJECTED, and a rejected promise makes every later `.then(step)` on that
		// same chain skip its callback — so one failed write would kill navigation for this one
		// pane for the rest of the session, silently, while every other lane is unaffected.
		// Catching inside the callback is what makes the chain recover by construction rather
		// than by anyone remembering to reset it. Reported by a review bot against this plan;
		// the lookup that used to share this boundary is answered inside `revealCandidate`'s own
		// boundary now, an `await` before anything is queued, so it cannot poison this chain at
		// all.
		try {
			// Read INSIDE the chain, not before it: a request superseded — by a LATER call for
			// this same leaf — while it waited its turn must not write at all, and by here this
			// lane's ticket reflects every call that has resolved to this leaf.
			if (issue !== chain.ticket) return;
			await leaf.setViewState({ type, active: true, state: { projectId: projectId ?? '', ...(section === 'prices' ? { section } : {}) } });
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
