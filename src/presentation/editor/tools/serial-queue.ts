/**
 * One promise chain: at most one operation's body runs at a time, and they run in the
 * order the calls arrived rather than the order they happen to resolve.
 *
 * Two places in this leaf need exactly that and had a copy each — `CommandHistory`, so
 * its undo/redo stacks mutate in dispatch order, and `withEditorStateRefresh`, so a
 * command and the read-back that follows it are one indivisible step. They sit directly
 * on top of one another, which is precisely why two copies is the wrong number: the
 * catch below is subtle enough to lose in a rewrite of either, and losing it wedges every
 * later gesture in the leaf with no error anywhere.
 *
 * **The queue itself must never reject.** An operation resolves a `Result` for every
 * EXPECTED failure, but SDD §65 still lets an unexpected technical fault throw — and a
 * rejected tail poisons every later `.then()` on the chain, so the next dispatch would
 * hang forever. The returned promise still carries its own outcome to its caller; the
 * catch protects only the shared chain.
 */
export function createSerialQueue(): <T>(operation: () => Promise<T>) => Promise<T> {
	let tail: Promise<unknown> = Promise.resolve();
	return <T>(operation: () => Promise<T>): Promise<T> => {
		const routed = tail.then(operation);
		tail = routed.catch(() => undefined);
		return routed;
	};
}
