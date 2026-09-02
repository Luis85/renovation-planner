import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { CommandHistory } from './command-history';
import { createSerialQueue } from './serial-queue';

/**
 * Everything slice 8's post-command funnel wraps (docs/tasks/08-zone-editing.md,
 * "Showing the result"). `Pick`ed, not the whole class: these three are the operations
 * that change persisted state and therefore need a read-back.
 *
 * The other members of `CommandHistory` do NOT pass through — this type is the decorator's
 * return type as well as its parameter, so `canUndo`, `canRedo` and `clear` are simply
 * absent from the decorated object, and a caller reaching for `clear()` on it gets
 * `undefined is not a function`. That is deliberate as far as the flags go (`wrapDispatcher`
 * mirrors them off the raw history as it steps), and it is a live gap for `clear()`, which
 * has no reachable caller through the one dispatcher a leaf is supposed to funnel through.
 * Said plainly here rather than described as a pass-through.
 *
 * Exported because it is part of this module's public signature, and an unexported name in
 * that position is a private-type leak.
 */
export type RefreshedHistory = Pick<CommandHistory, 'run' | 'undo' | 'redo'>;

/**
 * The decorator that puts a committed mutation on the surface that dispatched it — the
 * mechanism, with the SUBJECT left to the caller.
 *
 * Wraps the three `CommandHistory` operations rather than each site that mutates, so every
 * command a leaf does not even define is covered by sitting on the same funnel.
 *
 * Three properties, each held here rather than by any caller:
 *
 * - **The wrapped `Result` comes back unchanged**, success or failure, and a refresh failure
 *   never promotes a successful write to a failed one. A REJECTION propagates unchanged too,
 *   and refreshes on its way past — see `stepped`.
 * - **The operation and its refresh are ONE queued step, not two.** `CommandHistory`
 *   serializes operations, but its queue releases when the operation resolves — a refresh
 *   started after it runs outside it. Two concurrent dispatches could then interleave writes
 *   and re-reads so the store ends holding the OLDER command's snapshot. This decorator
 *   therefore holds its own queue around the pair (the same reasoning that put a queue inside
 *   `CommandHistory`: the guarantee belongs wherever the whole unit is).
 * - **Not a domain-event subscriber**: the undo paths publish nothing a creation subscriber
 *   would hear (restores go through the repository precisely so they are not announced as
 *   creations), so an event-keyed refresh would leave the surface blank after exactly the Undo
 *   the user pressed to get their work back. Sitting on the history covers every command
 *   regardless of what it publishes.
 *
 * **`refresh` is a parameter and not two named stores, which is what lets a second surface
 * have this at all.** The Plan Editor re-reads its project store and its Inspector;
 * the asset designer re-reads one design. Baking either list in would have made the next
 * surface either copy this file or widen a bundle it has no member of — and the rules above
 * are about the QUEUE and the rejection path, neither of which knows what is being re-read.
 */
export function withStateRefresh(history: RefreshedHistory, refresh: () => Promise<void>): RefreshedHistory {
	// At most one "write, then read back what was written" unit runs at a time, in dispatch
	// order — the same primitive `CommandHistory` serializes its own stacks with, shared
	// rather than copied (`./serial-queue.ts`).
	const enqueue = createSerialQueue();

	async function refreshQuietly(): Promise<void> {
		try {
			await refresh();
		} catch {
			// An UNEXPECTED fault in a read-only step still says nothing about the write,
			// which resolved already; the stores keep what they had and the write's own
			// `Result` is what the caller sees.
		}
	}

	/**
	 * The result is forwarded UNCHANGED, like every other part of one this decorator passes
	 * through: re-reading says nothing about whether the vault was touched, so the
	 * `DispatchOutcome` the command reported is the one the caller sees.
	 */
	function stepped(operation: () => Promise<DispatchResult>): () => Promise<DispatchResult> {
		return () =>
			enqueue(async () => {
				let result: DispatchResult;
				try {
					result = await operation();
				} catch (cause) {
					// An unexpected technical fault (SDD §65 reserves throws for those) says
					// NOTHING about whether a write landed — a repository's own post-write
					// bookkeeping runs after the bytes are on disk. So the read-back happens
					// here as well: refusing to refresh would leave the surface showing
					// pre-command state over a write that succeeded, which is the one outcome
					// worse than either. The fault itself still propagates unchanged.
					await refreshQuietly();
					throw cause;
				}
				// A refused command wrote nothing, so there is nothing to read back.
				if (result.ok) await refreshQuietly();
				return result;
			});
	}

	return {
		run: (command) => stepped(() => history.run(command))(),
		undo: () => stepped(() => history.undo())(),
		redo: () => stepped(() => history.redo())(),
	};
}
