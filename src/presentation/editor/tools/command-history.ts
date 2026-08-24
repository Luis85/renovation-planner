import { isErr, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
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

type VoidResult = Result<void, AppError>;

/**
 * The undo/redo stack for one open Plan (SDD §30, design slice 6). Ephemeral — it lives on
 * `EditorStore`, is scoped per Plan and does not survive a plugin reload or switching plans.
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
	// The serialization queue: every public operation chains onto this promise and replaces
	// it, so at most one operation's body is ever running and the stacks mutate in the
	// order calls arrived, not the order they happened to resolve.
	private tail: Promise<unknown> = Promise.resolve();

	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	run(command: UndoableCommand): Promise<VoidResult> {
		return this.enqueue(() => this.runNow(command));
	}

	undo(): Promise<VoidResult> {
		return this.enqueue(() => this.undoNow());
	}

	redo(): Promise<VoidResult> {
		return this.enqueue(() => this.redoNow());
	}

	/**
	 * Queued through the same serialization queue as `run`/`undo`/`redo`, not a plain
	 * synchronous reset — an unqueued `clear()` racing an in-flight command is exactly the
	 * defect the queue exists to prevent (a command could push onto a stack `clear()` had
	 * already emptied, or vice versa, depending on which finished last).
	 */
	clear(): Promise<VoidResult> {
		return this.enqueue(() => {
			this.undoStack = [];
			this.redoStack = [];
			return Promise.resolve(ok(undefined));
		});
	}

	private enqueue<T>(operation: () => Promise<T>): Promise<T> {
		const routed = this.tail.then(operation);
		// The queue itself must never reject: `run`/`undo`/`redo` resolve a `Result` for
		// every EXPECTED failure, but SDD §65 still lets an unexpected technical fault
		// throw — and a rejected `tail` would poison every later operation's `.then()`,
		// wedging the queue for every gesture after it. `routed` still carries its own
		// outcome to whoever called this operation; this catch only protects the shared
		// chain, so one command's unexpected throw cannot block the next one's turn.
		this.tail = routed.catch(() => undefined);
		return routed;
	}

	private async runNow(command: UndoableCommand): Promise<VoidResult> {
		const result = await command.execute();
		if (isErr(result)) return result;
		this.undoStack.push(command);
		if (this.undoStack.length > UNDO_DEPTH) this.undoStack.shift();
		this.redoStack = [];
		return ok(undefined);
	}

	private async undoNow(): Promise<VoidResult> {
		const command = this.undoStack[this.undoStack.length - 1];
		if (!command) return ok(undefined);
		const result = await command.undo();
		if (isErr(result)) return result;
		this.undoStack.pop();
		this.redoStack.push(command);
		return ok(undefined);
	}

	private async redoNow(): Promise<VoidResult> {
		const command = this.redoStack[this.redoStack.length - 1];
		if (!command) return ok(undefined);
		const result = await command.execute();
		if (isErr(result)) return result;
		this.redoStack.pop();
		this.undoStack.push(command);
		return ok(undefined);
	}
}
