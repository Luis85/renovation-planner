import { describe, expect, it, vi } from 'vitest';
import { err, isErr, ok, type Result } from '../../../../src/core/result/Result';
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
const failExecute = (): UndoableCommand => ({
	execute: vi.fn<ResultThunk>(() => Promise.resolve(err({ category: 'Validation', code: 'x.fail', message: 'fail' }))),
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
	it('never pushes a command whose execute resolves a failed Result and returns that same Result', async () => {
		const h = new CommandHistory();
		const failed = failExecute();
		const result = await h.run(failed);
		expect(isErr(result)).toBe(true);
		expect(h.canUndo).toBe(false);
		expect(failed.execute).toHaveBeenCalledTimes(1);
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
	it('serializes operations: second execute does not begin until first resolved', async () => {
		const h = new CommandHistory();
		const slow = okCommand(30); // dispatched first, resolves last
		const fast = okCommand(0);
		void h.run(slow);
		void h.run(fast);
		await h.undo();
		await h.undo(); // queued behind both runs
		const slowOrder = vi.mocked(slow.execute).mock.invocationCallOrder[0];
		const fastOrder = vi.mocked(fast.execute).mock.invocationCallOrder[0];
		expect(slowOrder).toBeLessThan(fastOrder);
		const stack = (h as never as { undoStack: unknown[] }).undoStack;
		expect(stack).toHaveLength(0); // both undone, LIFO completed without interleave
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
