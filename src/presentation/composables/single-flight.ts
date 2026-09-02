/**
 * "Read again, but never twice at once."
 *
 * **COALESCED, because hearing the right events is not the same as hearing few of them.** A
 * library migration renames every catalogue note one at a time and `VaultChangeAdapter`
 * announces each rename, so moving N assets delivers N events — and an unconditional read per
 * event is N vault-wide scans in every open surface, for a change of paths. Never more than one
 * read is in flight; a burst arriving during one collapses into exactly one more after it.
 *
 * That the reads cannot OVERLAP is the second property, and it is what removes the
 * stale-overwrite race this repository has already recorded three times (`ProjectStore.hydrate`,
 * `InspectorStore` and `ProjectDetailStore` each carry a request ticket for it): an older scan
 * cannot finish after a newer one and put a deleted entry back, because there is never an older
 * scan still running.
 *
 * **Both mechanisms stay, because neither does the other's job.** A request ticket ORDERS reads
 * it did not issue — a fresh mount, a navigation racing a refresh — and only this can stop a read
 * STARTING.
 *
 * The trailing read is a REQUEST rather than a queue: ten events during one scan buy one more
 * scan, not ten. What that gives up is knowing which event the final read answers, which no
 * caller here needs — the read is a full snapshot either way.
 *
 * It lives in `presentation/composables/` rather than in `runtime.ts`, where it was written,
 * because the project pane's price section is its second caller and one function with two
 * callers cannot drift the way two hand-spelled copies can. It uses no Vue reactivity and is a
 * composable only by neighbourhood.
 */
export function singleFlight(read: () => Promise<void>): () => void {
	let running = false;
	let requestedAgain = false;
	const run = async (): Promise<void> => {
		running = true;
		try {
			do {
				requestedAgain = false;
				await read();
			} while (requestedAgain);
		} finally {
			running = false;
		}
	};
	return (): void => {
		if (running) {
			requestedAgain = true;
			return;
		}
		void run();
	};
}
