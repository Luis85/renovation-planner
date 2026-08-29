import type { Workspace, WorkspaceLeaf } from 'obsidian';

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
	workspace: Workspace,
	type: string,
	candidates: readonly WorkspaceLeaf[],
	state?: Record<string, unknown>,
): Promise<void> {
	const key = requestKey(type, state);
	const inFlight = activating.get(key);
	if (inFlight !== undefined) return inFlight;
	const existing = candidates[0];
	if (existing !== undefined) {
		await workspace.revealLeaf(existing);
		return;
	}
	// Recorded before the first `await`, so a call landing in the same tick as this one finds
	// it. A rejection is shared rather than swallowed: both clicks asked for the same
	// activation, and the same activation failed.
	const leaf = workspace.getLeaf('tab');
	const activation = leaf
		.setViewState({ type, active: true, state })
		.then(() => workspace.revealLeaf(leaf));
	activating.set(key, activation);
	try {
		await activation;
	} finally {
		activating.delete(key);
	}
}
