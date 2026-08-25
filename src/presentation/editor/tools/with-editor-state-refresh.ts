import type { AppError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import type { PlanEditorQueryServices } from '../../read-models/planEditorQueries';
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
 * `undefined is not a function`. That is deliberate as far as the flags go (`runtime.ts`
 * mirrors them off the raw history as it steps), and it is a live gap for `clear()`, which
 * has no reachable caller through the one dispatcher a leaf is supposed to funnel through.
 * Said plainly here rather than described as a pass-through, which is what this paragraph
 * used to claim.
 *
 * Exported because it is part of this module's public signature, and an unexported name in
 * that position is a private-type leak.
 */
export type RefreshedHistory = Pick<CommandHistory, 'run' | 'undo' | 'redo'>;

/** Both stores hold working state; both are refreshed, never one standing in for the other. */
export interface EditorStateRefreshDeps {
	/**
	 * Slice 5's own hydration routine, re-run after every committed operation with
	 * `keepPreviousOnFailure: true` — a refresh is a read of data that is already
	 * written, and its failure must neither blank the canvas nor alter the wrapped
	 * `Result`.
	 */
	projectStore: {
		hydrate(
			queries: PlanEditorQueryServices,
			planId: string,
			options?: { readonly keepPreviousOnFailure?: boolean },
		): Promise<void>;
	};
	/** Slice 6's own invalidation of the cached Inspector DTO. Only this member. */
	inspectorStore: { refresh(): Promise<void> };
	queries: PlanEditorQueryServices;
	/** The plan this editor leaf shows; every refresh re-reads exactly it. */
	planId: string;
}

type VoidResult = Result<void, AppError>;

/**
 * The decorator that puts a committed mutation on the canvas AND in the Inspector
 * (design slice 8). Wraps the three `CommandHistory` operations rather than each site
 * that mutates, so every command this slice does not even define — slice 6's Inspector
 * commits, slice 7's calibration rescale — is covered by sitting on the same funnel.
 *
 * Three properties, each stated in the spec and held here:
 *
 * - **The wrapped `Result` comes back unchanged**, success or failure, and a refresh
 *   failure never promotes a successful write to a failed one. A REJECTION propagates
 *   unchanged too, and refreshes on its way past — see `stepped`. The canvas re-hydration
 * runs first and the Inspector second, inside the one queued step: a selection is only
 * meaningful against the entity map the canvas hit-tests, so a new DTO must never pair
 * with a pre-command entity set.
 * - **The operation and its refresh are ONE queued step, not two.** `CommandHistory`
 * serializes operations, but its queue releases when the operation resolves — a refresh
 * started after it runs outside it. Two concurrent dispatches could then interleave
 * writes and re-reads so the store ends holding the OLDER command's snapshot. This
 * decorator therefore holds its own queue around the pair (the same reasoning that put
 * a queue inside `CommandHistory`: the guarantee belongs wherever the whole unit is).
 * - **Not a domain-event subscriber**: the undo paths in this slice publish nothing a
 * `ZoneCreated` subscriber would hear (restores go through the repository precisely so
 * they are not announced as creations), so an event-keyed refresh would leave the
 * canvas blank after exactly the Undo the user pressed to get their zone back.
 * Sitting on the history covers every command regardless of what it publishes.
 */
export function withEditorStateRefresh(
	history: RefreshedHistory,
	deps: EditorStateRefreshDeps,
): RefreshedHistory {
	// At most one "write, then read back what was written" unit runs at a time, in dispatch
	// order — the same primitive `CommandHistory` serializes its own stacks with, shared
	// rather than copied (`./serial-queue.ts`).
	const enqueue = createSerialQueue();

	async function refresh(): Promise<void> {
		try {
			await deps.projectStore.hydrate(deps.queries, deps.planId, { keepPreviousOnFailure: true });
			await deps.inspectorStore.refresh();
		} catch {
			// An UNEXPECTED fault in a read-only step still says nothing about the write,
			// which resolved already; the stores keep what they had and the write's own
			// `Result` is what the caller sees.
		}
	}

	function stepped(operation: () => Promise<VoidResult>): () => Promise<VoidResult> {
		return () =>
			enqueue(async () => {
				let result: VoidResult;
				try {
					result = await operation();
				} catch (cause) {
					// An unexpected technical fault (SDD §65 reserves throws for those) says
					// NOTHING about whether a write landed — `ObsidianZoneRepository`'s own
					// post-write bookkeeping runs after both files are on disk. So the stores
					// are re-read here as well: refusing to refresh would leave the canvas
					// showing pre-command state over a write that succeeded, which is the one
					// outcome worse than either. The fault itself still propagates to the
					// caller unchanged.
					await refresh();
					throw cause;
				}
				// A refused command wrote nothing, so there is nothing to read back.
				if (result.ok) await refresh();
				return result;
			});
	}

	return {
		run: (command) => stepped(() => history.run(command))(),
		undo: () => stepped(() => history.undo())(),
		redo: () => stepped(() => history.redo())(),
	};
}
