/**
 * Let every pending microtask AND the fire-and-forget work they started finish.
 *
 * A macrotask turn drains all of them regardless of how many hops there are, which a counted
 * number of `await Promise.resolve()`s does not: that number is a fact about today's
 * implementation and goes stale silently, in the direction of a test asserting on a gesture
 * that has not happened yet. `registration.test.ts` was exactly that — one microtask between
 * a ribbon click and a command invocation, which is an input no human can produce, and which
 * started certifying a different program the moment `revealCandidate` learned to coalesce
 * activations still in flight.
 *
 * Use it where the code under test is DETACHED and there is no promise to await. Where there
 * IS one, await that instead: this helper cannot tell "finished" from "gave up".
 */
export function settle(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 0);
	});
}
