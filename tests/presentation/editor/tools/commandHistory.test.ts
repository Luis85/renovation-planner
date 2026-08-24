import { describe, expect, it, vi } from 'vitest';
import { err, ok, type Result } from '../../../../src/core/result/Result';
import type { AppError } from '../../../../src/core/errors/AppError';
import { CommandHistory, UNDO_DEPTH } from '../../../../src/presentation/editor/tools/command-history';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';

type VoidResult = Result<void, AppError>;
type ResultThunk = () => Promise<VoidResult>;

let seq = 0;
const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
const okCommand = (cascadeMs = 0): UndoableCommand & { id: number } => {
	const id = ++seq;
	return {
		id,
		execute: vi.fn<ResultThunk>(async () => {
			await delay(cascadeMs);
			return ok(undefined);
		}),
		undo: vi.fn<ResultThunk>(async () => {
			await delay(cascadeMs);
			return ok(undefined);
		}),
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
		// against an unserialized implementation. `slow` (30ms cascade) is dispatched
		// first and resolves last; `fast` (no cascade) is dispatched second and would
		// resolve first if the two ran independently.
		const h = new CommandHistory();
		const slow = okCommand(30);
		const fast = okCommand(0);
		const slowRun = h.run(slow);
		const fastRun = h.run(fast);
		// Checkpoint well inside slow's 30ms cascade, before its own setTimeout fires: an
		// unserialized `run` would have already invoked BOTH executes synchronously at
		// dispatch time, so this is where the bug shows.
		await delay(10);
		expect(slow.execute).toHaveBeenCalledTimes(1); // slow's operation is under way
		expect(fast.execute).not.toHaveBeenCalled(); // fast is still queued behind it
		await slowRun;
		await fastRun;
		expect(fast.execute).toHaveBeenCalledTimes(1); // began only once slow had resolved
		const stack = (h as never as { undoStack: { id: number }[] }).undoStack;
		expect(stack.map((c) => c.id)).toEqual([slow.id, fast.id]); // dispatch order, not completion order
	});
	it(`caps the undo stack at UNDO_DEPTH (${UNDO_DEPTH}) and still reports canUndo`, async () => {
		const h = new CommandHistory();
		for (let i = 0; i < UNDO_DEPTH + 5; i++) await h.run(okCommand());
		const stack = (h as never as { undoStack: unknown[] }).undoStack;
		expect(stack).toHaveLength(UNDO_DEPTH);
		expect(h.canUndo).toBe(true);
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
