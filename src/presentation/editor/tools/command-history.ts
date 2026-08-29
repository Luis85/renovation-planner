import { isErr, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { DispatchOutcome } from '../../../application/commands/DispatchOutcome';
import { createSerialQueue } from './serial-queue';
import type { UndoableCommand } from './undoable-command';

/**
 * Entries per Plan Editor, oldest dropped on push (design slice 6). A hundred rather than
 * a tuned number: nothing here can measure a snapshot's real size (a reversible adapter
 * captures whole-geometry `before`/`after` snapshots), and `npm run perf` is deliberately
 * absent until there is a render cost to argue about. The cap is only on `undoStack`;
 * `redoStack` is bounded by it transitively, since nothing reaches redo except by being
 * undone.
 */
export const UNDO_DEPTH = 100;

/**
 * What every operation here resolves. The outcome is the COMMAND's, forwarded unchanged —
 * this class decides stacks and never decides whether the vault was touched. Its own two
 * empty-stack arms are the exception, and they are the only place it mints one: an undo with
 * nothing to undo, and a redo with nothing to redo, both of which succeed without reaching a
 * command at all. Before `DispatchOutcome` existed those two resolved a bare `ok` that the
 * save indicator read as a write, and pressing a disabled-looking Undo cleared a `save-error`
 * over data nobody had saved.
 */
type DispatchResult = Result<DispatchOutcome, AppError>;

/**
 * The undo/redo stack for one open Plan (SDD §30, design slice 6). Ephemeral by design
 * (SDD §15) and scoped per Plan — meant to live on `EditorStore`, and to not survive a
 * plugin reload or switching plans. Nothing in `src/` constructs or holds an instance yet:
 * design slice 6 built this framework and wired none of it into the composition root, so
 * giving `EditorStore` a home for it is later work for whichever task first constructs a
 * `ToolManager`/`EditorContext` there — the same situation `./render-state.ts` describes
 * for `hoveredObjectId`/`temporaryPolygon`, and not a task this slice left undone.
 *
 * Two things make this class more than "two arrays and three methods":
 *
 * 1. **A resolved `Result` is not the same as a resolved promise.** Every
 *    `UndoableCommand.execute()`/`undo()` resolves a `Result` rather than rejecting for an
 *    expected domain or persistence failure (SDD §65) — so "the promise resolved" is not
 *    enough to decide whether a stack should move. All three operations inspect the
 *    resolved `Result` explicitly before touching a stack: a failed `execute()` leaves
 *    `undoStack` untouched and returns the same failed `Result`; a failed `undo()` leaves
 *    the command on `undoStack` rather than moving it to `redoStack`, because the Vault is
 *    still in the state the command left it in and the command is still retryable; a failed
 *    `redo()` leaves the command on `redoStack` symmetrically. Neither stack is popped
 *    until the corresponding operation is confirmed to have succeeded.
 *
 * 2. **`run`, `undo` and `redo` serialize against one another through one queue.** This is
 *    not defensive coding around a rare interleaving — it is the only thing that makes the
 *    stacks' order meaningful. A command does not finish when its write lands: it goes on
 *    to await its event cascade, run to completion inside the same dispatch (slice 10). A
 *    command with a short cascade can therefore resolve before an earlier one with a long
 *    cascade started first, and an unserialized `run()` would push them in COMPLETION
 *    order rather than dispatch order — leaving Undo pointed at the wrong edit. Slice 4's
 *    per-plan write lock does not help here: it releases when the write completes, long
 *    before the cascade does. `CommandHistory` is already scoped per open Plan, so the
 *    queue needs no key — one instance, one Plan, one order.
 */
export class CommandHistory {
	private undoStack: UndoableCommand[] = [];
	private redoStack: UndoableCommand[] = [];
	// The serialization queue: every public operation goes through it, so at most one
	// operation's body is ever running and the stacks mutate in the order calls arrived,
	// not the order they happened to resolve. Shared with `withEditorStateRefresh`, which
	// wraps this class and needs the same guarantee one level up — see `./serial-queue.ts`
	// for why the chain must never reject.
	private readonly enqueue = createSerialQueue();

	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	run(command: UndoableCommand): Promise<DispatchResult> {
		return this.enqueue(() => this.runNow(command));
	}

	undo(): Promise<DispatchResult> {
		return this.enqueue(() => this.undoNow());
	}

	redo(): Promise<DispatchResult> {
		return this.enqueue(() => this.redoNow());
	}

	/**
	 * Queued through the same serialization queue as `run`/`undo`/`redo`, not a plain
	 * synchronous reset — an unqueued `clear()` racing an in-flight command is exactly the
	 * defect the queue exists to prevent (a command could push onto a stack `clear()` had
	 * already emptied, or vice versa, depending on which finished last).
	 */
	clear(): Promise<DispatchResult> {
		return this.enqueue(() => {
			this.undoStack = [];
			this.redoStack = [];
			// Emptying two arrays is not a write.
			return Promise.resolve(ok('no-write'));
		});
	}

	private async runNow(command: UndoableCommand): Promise<DispatchResult> {
		const result = await command.execute();
		if (isErr(result)) return result;
		this.undoStack.push(command);
		if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
		this.redoStack = [];
		// The COMMAND's answer, forwarded. A gesture that wrote nothing still goes on the undo
		// stack: it happened, and asking to undo it is legal.
		return result;
	}

	private async undoNow(): Promise<DispatchResult> {
		const command = this.undoStack[this.undoStack.length - 1];
		if (!command) return ok('no-write');
		const result = await command.undo();
		if (isErr(result)) return result;
		this.undoStack.pop();
		this.redoStack.push(command);
		return result;
	}

	private async redoNow(): Promise<DispatchResult> {
		const command = this.redoStack[this.redoStack.length - 1];
		if (!command) return ok('no-write');
		const result = await command.execute();
		if (isErr(result)) return result;
		this.redoStack.pop();
		this.undoStack.push(command);
		return result;
	}
}
