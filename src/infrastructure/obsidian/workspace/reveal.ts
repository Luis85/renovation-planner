import type { Workspace, WorkspaceLeaf } from 'obsidian';

/**
 * What an activation needs, and the second member is the whole of this module's fault policy.
 *
 * `reportFault` is REQUIRED rather than optional, for the reason `useFieldCommit`'s own notice
 * door is: an optional-with-a-default lets the one call site that forgets it fail silently,
 * and this is the only place a failed activation is answered at all. It is composed in
 * `plugin/` — the one layer that may reach both `infrastructure/` and
 * `presentation/notices/notify` — and CALLED here, because here is where the coalescing is.
 * That is the same split, for the same reason, that `openProjectNote` already takes.
 */
export interface RevealDeps {
	readonly workspace: Workspace;
	readonly reportFault: (cause: unknown) => void;
}

/**
 * The activations currently in flight, by the leaf each one is asking for — what makes a
 * DOUBLE click on the ribbon one tab.
 *
 * A candidate list is read from `getLeavesOfType`, and a leaf this call creates does not
 * answer that lookup until `setViewState` resolves. So every activation arriving before the
 * first one settles finds no candidate and creates a leaf of its own: measured, two calls in
 * one tick produce two leaves, for BOTH callers — two tabs of a view whose whole premise is
 * that there is one, and two Plan Editors on one plan. The window is wider here than at the
 * other leaf-creating door (`openProjectNote`), because `setViewState` on a real leaf runs
 * the registered factory and the view's `onOpen`, which for these two views mounts a Vue app
 * and issues a query.
 *
 * **The KEY is the type plus the state that would be set, and that is a derivation rather
 * than a convenience.** `setViewState({ type, active, state })` is the whole of what makes
 * the leaf, so two calls agreeing on both are asking for a leaf neither could tell from the
 * other's — which is exactly what "the same request" means here. It needs no parameter and no
 * caller has to remember it, which is the point: this module exists because a subtlety
 * re-remembered per function is one that eventually is not. Entries are sorted so that two
 * equal states written in different key orders do not miss each other.
 *
 * Bounded by its own `finally`: an entry lives exactly as long as the activation it
 * describes, so a later click takes the ordinary candidate lookup rather than a stale promise.
 *
 * **What it holds is the ANSWERED activation**, never the raw one — see `revealCandidate`.
 */
const activating = new Map<string, Promise<void>>();

/**
 * What identifies the leaf an activation is asking for.
 *
 * `JSON.stringify`'s property-LIST replacer both filters and ORDERS, so handing it the sorted
 * keys makes this key independent of the order a caller happened to write them in — and does
 * it without a comparator, which is the part worth keeping: a hand-written one is a function
 * nothing calls while every caller passes a single-key state, so it would be an untestable arm
 * rather than a safeguard. The NUL separator keeps a type ending in digits from colliding with
 * a serialized state that begins with them.
 */
function requestKey(type: string, state?: Record<string, unknown>): string {
	if (state === undefined) return type;
	return `${type}\u0000${JSON.stringify(state, Object.keys(state).toSorted())}`;
}

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
 *
 * **Uniqueness is decided in TWO places, because the candidate lookup cannot see a request
 * that has not finished arriving.** `activating` is the second, and it is asked FIRST: a
 * candidate and an in-flight creation are mutually exclusive for both callers today — a
 * creation only ever starts because the lookup found nothing — so asking it first costs a
 * map read and closes the gesture users actually perform.
 */
export async function revealCandidate(
	deps: RevealDeps,
	type: string,
	candidates: readonly WorkspaceLeaf[],
	state?: Record<string, unknown>,
): Promise<void> {
	const key = requestKey(type, state);
	const inFlight = activating.get(key);
	if (inFlight !== undefined) return inFlight;
	try {
		const existing = candidates[0];
		if (existing !== undefined) {
			await deps.workspace.revealLeaf(existing);
			return;
		}
		// Recorded before the first `await`, so a call landing in the same tick as this one
		// finds it — and recorded ALREADY ANSWERED, which is the half a review round found
		// missing. The map used to hold the RAW activation, so a joining click was handed the
		// same rejection and each caller reported it: measured, two notices and two identical
		// log lines for one failed double click. Sharing an operation means sharing its
		// failure too, and one failure is one report.
		const leaf = deps.workspace.getLeaf('tab');
		const activation = leaf
			.setViewState({ type, active: true, state })
			.then(() => deps.workspace.revealLeaf(leaf))
			.catch((cause: unknown) => {
				deps.reportFault(cause);
			});
		activating.set(key, activation);
		try {
			await activation;
		} finally {
			activating.delete(key);
		}
	} catch (cause) {
		// The paths the inner handler cannot reach: revealing an EXISTING leaf, which is not
		// coalesced and therefore never went through it, and a synchronous throw from
		// `getLeaf`. Both mattered the moment this module took the fault over from
		// `runDetached` — a caller that no longer wraps this has nothing left to catch what
		// escapes, so an activation that answers only SOME of its faults turns the rest into
		// unhandled rejections reaching nobody. Answering all of them is what lets the two
		// detached call sites hand the promise straight to `void`.
		deps.reportFault(cause);
	}
}
