import { describe, expect, it, vi } from 'vitest';
import { err, ok, type Result } from '../../../../src/core/result/Result';
import type { AppError } from '../../../../src/core/errors/AppError';
import { CommandHistory, UNDO_DEPTH } from '../../../../src/presentation/editor/tools/command-history';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';

type VoidResult = Result<void, AppError>;
type ResultThunk = () => Promise<VoidResult>;

let seq = 0;

/**
 * A promise this file resolves by hand. It stands in for a command's event cascade (slice
 * 10) wherever a test needs one operation to still be in flight while it asserts something
 * about the next — with no wall clock involved, so nothing here can be raced by a slow CI
 * runner. `gestureTransaction.test.ts` proves the same technique against the same
 * guarantee, one level up.
 */
function deferred(): { cascade: Promise<void>; release: () => void } {
	let release!: () => void;
	const cascade = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { cascade, release };
}

/** A command that succeeds, optionally not until `cascade` resolves. */
const okCommand = (cascade?: Promise<void>): UndoableCommand & { id: number } => {
	const id = ++seq;
	const succeed = async (): Promise<VoidResult> => {
		if (cascade !== undefined) await cascade;
		return ok(undefined);
	};
	return {
		id,
		execute: vi.fn<ResultThunk>(succeed),
		undo: vi.fn<ResultThunk>(succeed),
	};
};
// Pinned to one object identity so the "returns that SAME Result" half of the
// requirement can be asserted with `toBe`, not just `isErr(result)` — which any `err(...)`
// would satisfy, including a handler that re-wrapped the failure into a new object.
const executeFailure: Result<void, AppError> = err({ category: 'Validation', code: 'x.fail', message: 'fail' });
const failExecute = (): UndoableCommand => ({
	execute: vi.fn<ResultThunk>(() => Promise.resolve(executeFailure)),
	undo: vi.fn<ResultThunk>(() => Promise.resolve(ok(undefined))),
});
const failUndo = (): UndoableCommand => ({
	execute: vi.fn<ResultThunk>(() => Promise.resolve(ok(undefined))),
	undo: vi.fn<ResultThunk>(() => Promise.resolve(err({ category: 'Persistence', code: 'y.fail', message: 'fail' }))),
});

describe('CommandHistory', () => {
	it('pushes a successful run and clears the redo stack', async () => {
		const h = new CommandHistory();
		await h.run(okCommand());
		expect(h.canUndo).toBe(true);
		await h.run(okCommand());
		await h.undo();
		expect(h.canRedo).toBe(true);
		const result = await h.run(okCommand());
		expect(result).toEqual(ok(undefined));
		expect(h.canRedo).toBe(false);
	});
	it('never pushes a command whose execute resolves a failed Result, returns that same Result, and leaves an existing redo stack intact', async () => {
		const h = new CommandHistory();
		// Populate redoStack first, so a failed run's early return proves it never reaches
		// the `redoStack = []` line — the success path is the only one exercised elsewhere.
		await h.run(okCommand());
		await h.undo();
		expect(h.canRedo).toBe(true);
		const failed = failExecute();
		const result = await h.run(failed);
		expect(result).toBe(executeFailure); // the exact same Result, not merely any err(...)
		expect(h.canUndo).toBe(false);
		expect(failed.execute).toHaveBeenCalledTimes(1);
		expect(h.canRedo).toBe(true); // untouched by the failed run
	});
	it('a failed undo leaves the command on the undo stack', async () => {
		const h = new CommandHistory();
		const cmd = failUndo();
		await h.run(cmd);
		await h.undo();
		expect(h.canUndo).toBe(true); // still retryable
		expect(h.canRedo).toBe(false); // never moved
	});
	it('a failed redo leaves the command on the redo stack', async () => {
		const h = new CommandHistory();
		const cmd = okCommand();
		await h.run(cmd);
		cmd.execute = () => Promise.resolve(err({ category: 'Geometry', code: 'z.fail', message: 'fail' }));
		await h.undo();
		await h.redo();
		expect(h.canRedo).toBe(true);
		expect(h.canUndo).toBe(false);
	});
	it('serializes: two commands dispatched without awaiting the first land on undoStack in dispatch order, and the second does not begin until the first has resolved', async () => {
		// Spec (docs/tasks/06-...): "assert undoStack holds them in dispatch order and
		// that the second's execute() does not begin until the first's has resolved" — and
		// warns that a test whose two fakes resolve in dispatch order anyway would pass
		// against an unserialized implementation. `slow` is dispatched first and resolves
		// only when this test says so; `fast` is dispatched second and resolves the instant
		// it is invoked, so completion order disagrees with dispatch order by construction.
		//
		// **No wall clock.** An earlier version of this test used a real 30ms cascade with a
		// `delay(10)` checkpoint inside it, which asks a CI runner — Windows is one of the
		// four legs — not to stall for 20ms at the wrong moment. `slow`'s promise is
		// unresolved because nothing has resolved it, not because a timer has not fired yet.
		const h = new CommandHistory();
		const slow = deferred();
		const slowCommand = okCommand(slow.cascade);
		const fast = okCommand();
		const slowRun = h.run(slowCommand);
		const fastRun = h.run(fast);
		// One microtask tick, which is all the queued first operation needs to start (its
		// `execute()` runs synchronously inside that operation). An unserialized `run` would
		// have invoked BOTH executes by now, so this is where the bug shows.
		await Promise.resolve();
		expect(slowCommand.execute).toHaveBeenCalledTimes(1); // slow's operation is under way
		expect(fast.execute).not.toHaveBeenCalled(); // fast is still queued behind it
		slow.release();
		await slowRun;
		await fastRun;
		expect(fast.execute).toHaveBeenCalledTimes(1); // began only once slow had resolved
		const stack = (h as never as { undoStack: { id: number }[] }).undoStack;
		expect(stack.map((c) => c.id)).toEqual([slowCommand.id, fast.id]); // dispatch order, not completion order
	});
	it(`caps the undo stack at UNDO_DEPTH (${UNDO_DEPTH}) by dropping the OLDEST, still reports canUndo, and leaves redoStack alone`, async () => {
		// DoD 13 in full: "pushing one entry past the cap drops the oldest, `canUndo` still
		// reports true, and `redoStack` is unaffected."
		//
		// The length alone proves none of that. `undoStack.shift()` (drop the oldest) and
		// `undoStack.pop()` (drop the one just pushed) both leave exactly UNDO_DEPTH
		// entries, and only the second is a bug — it would leave `undo()` replaying the
		// hundredth command forever while every newer gesture vanished. So this reads the
		// IDENTITIES back: the surviving stack must be the last UNDO_DEPTH commands
		// dispatched, in order. Five past the cap rather than one, so a drop-from-the-wrong-
		// end is visible at both ends of the array rather than at a single boundary.
		const h = new CommandHistory();
		const dispatched: (UndoableCommand & { id: number })[] = [];
		for (let i = 0; i < UNDO_DEPTH + 5; i++) {
			const command = okCommand();
			dispatched.push(command);
			await h.run(command);
		}
		const stack = (h as never as { undoStack: { id: number }[] }).undoStack;
		expect(stack).toHaveLength(UNDO_DEPTH);
		expect(stack.map((command) => command.id)).toEqual(
			dispatched.slice(-UNDO_DEPTH).map((command) => command.id),
		);
		expect(h.canUndo).toBe(true);
		// `redoStack` is unaffected: overflowing the cap is not an undo, so nothing the cap
		// discards may turn up as something to redo.
		expect(h.canRedo).toBe(false);
	});
	it('clear() empties both stacks', async () => {
		const h = new CommandHistory();
		await h.run(okCommand());
		await h.clear();
		expect(h.canUndo).toBe(false);
		expect(h.canRedo).toBe(false);
	});

	// The seven cases above are the brief's required set. These four cover behaviour the
	// spec's CommandHistory pseudocode specifies that none of the seven exercises:

	it('a successful redo moves the command back from the redo stack to the undo stack', async () => {
		// None of the seven brief cases drive redo() to success — test 4 covers only the
		// failed-redo branch. The pseudocode's success path (`pop redoStack, push
		// undoStack`) is otherwise untested.
		const h = new CommandHistory();
		const cmd = okCommand();
		await h.run(cmd);
		await h.undo();
		expect(h.canRedo).toBe(true);
		const result = await h.redo();
		expect(result).toEqual(ok(undefined));
		expect(h.canRedo).toBe(false);
		expect(h.canUndo).toBe(true);
		expect(cmd.execute).toHaveBeenCalledTimes(2); // the run, then the redo
	});

	it('undo() with nothing to undo is a no-op that resolves ok', async () => {
		// `undoNow`'s empty-stack guard is reachable through the public API any time a
		// caller invokes undo() without checking canUndo first — not a defensive arm
		// nothing can reach.
		const h = new CommandHistory();
		expect(h.canUndo).toBe(false);
		const result = await h.undo();
		expect(result).toEqual(ok(undefined));
		expect(h.canUndo).toBe(false);
		expect(h.canRedo).toBe(false);
	});

	it('redo() with nothing to redo is a no-op that resolves ok', async () => {
		const h = new CommandHistory();
		expect(h.canRedo).toBe(false);
		const result = await h.redo();
		expect(result).toEqual(ok(undefined));
		expect(h.canUndo).toBe(false);
		expect(h.canRedo).toBe(false);
	});

	it('an unexpected rejection from one operation does not wedge the serialization queue', async () => {
		// SDD §65: only an UNEXPECTED technical fault throws (an expected one resolves a
		// failed Result, covered above). `enqueue`'s `.catch(() => undefined)` exists so a
		// command that rejects still lets the next queued operation run — this is the only
		// path that reaches it, since every well-behaved command here resolves rather than
		// rejects.
		const h = new CommandHistory();
		const broken: UndoableCommand = {
			execute: vi.fn<ResultThunk>(() => Promise.reject(new Error('unexpected fault'))),
			undo: vi.fn<ResultThunk>(() => Promise.resolve(ok(undefined))),
		};
		const runPromise = h.run(broken);
		const next = okCommand();
		const nextPromise = h.run(next);
		await expect(runPromise).rejects.toThrow('unexpected fault');
		const nextResult = await nextPromise;
		expect(nextResult).toEqual(ok(undefined));
		expect(h.canUndo).toBe(true); // only `next`; `broken` never pushed
	});
});
