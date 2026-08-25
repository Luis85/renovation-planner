import type { AppError } from '../../../core/errors/AppError';
import type { Result } from '../../../core/result/Result';
import type { PlanEditorQueryServices } from '../../read-models/planEditorQueries';
import type { CommandHistory } from './command-history';

/**
 * Everything slice 8's post-command funnel wraps (docs/tasks/08-zone-editing.md,
 * "Showing the result"). `Pick`ed, not the whole class: `canUndo`/`canRedo`/`clear`
 * change no persisted state to re-read and pass through untouched.
 */
type RefreshedHistory = Pick<CommandHistory, 'run' | 'undo' | 'redo'>;

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
 *   failure never promotes a successful write to a failed one. The canvas re-hydration
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
	// One promise chain, `CommandHistory`'s own shape: at most one "write, then read back
	// what was written" unit runs at a time, in dispatch order.
	let tail: Promise<unknown> = Promise.resolve();
	function enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const routed = tail.then(operation);
		tail = routed.catch(() => undefined);
		return routed;
	}

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
				const result = await operation();
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
