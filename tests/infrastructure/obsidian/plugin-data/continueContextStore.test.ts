import { describe, expect, it, vi } from 'vitest';
import {
	ContinueContextStore,
	type LocalStorageAdapter,
} from '../../../../src/infrastructure/obsidian/plugin-data/continueContextStore';
import { recorder as logger, resetRecorder } from '../../../helpers/logger';

const KEY = 'renovation-planner:continue-context';

/**
 * A fake over `App.loadLocalStorage`/`saveLocalStorage` — an in-memory `Map`, since Obsidian's
 * real pair already deserializes/serializes for the caller (`loadLocalStorage` answers the
 * stored VALUE, never a JSON string), which is the whole reason this store carries no
 * `JSON.parse`/`JSON.stringify` of its own.
 */
function fakeAdapter(initial?: unknown): { adapter: LocalStorageAdapter; entries: Map<string, unknown> } {
	const entries = new Map<string, unknown>();
	if (initial !== undefined) entries.set(KEY, initial);
	return {
		entries,
		adapter: {
			loadLocalStorage: (key) => entries.get(key) ?? null,
			saveLocalStorage: (key, data) => {
				if (data === null) entries.delete(key);
				else entries.set(key, data);
			},
		},
	};
}

describe('ContinueContextStore', () => {
	it('round-trips a context through the adapter', async () => {
		const { adapter } = fakeAdapter();
		const store = new ContinueContextStore(adapter, KEY, logger);

		await store.write({ projectId: 'p1', planId: 'plan-1' });

		expect(await store.read()).toEqual({ projectId: 'p1', planId: 'plan-1' });
	});

	it('answers null when nothing has been written', async () => {
		const { adapter } = fakeAdapter();
		expect(await new ContinueContextStore(adapter, KEY, logger).read()).toBeNull();
	});

	it.each([
		['a bare string', 'p1'],
		['a number', 42],
		['an array', ['p1']],
		['an object missing schemaVersion', { context: { projectId: 'p1', planId: null } }],
	])('answers null for %s rather than throwing', async (_what, stored) => {
		const { adapter } = fakeAdapter(stored);
		expect(await new ContinueContextStore(adapter, KEY, logger).read()).toBeNull();
	});

	it('answers null for a schemaVersion this build does not read', async () => {
		const { adapter } = fakeAdapter({ schemaVersion: 99, context: { projectId: 'p1', planId: null } });
		expect(await new ContinueContextStore(adapter, KEY, logger).read()).toBeNull();
	});

	it('writes a versioned envelope, so a future shape has something to branch on', async () => {
		const { adapter, entries } = fakeAdapter();
		await new ContinueContextStore(adapter, KEY, logger).write({ projectId: 'p1', planId: null });

		expect(entries.get(KEY)).toEqual({ schemaVersion: 1, context: { projectId: 'p1', planId: null } });
	});

	it('never rejects on a failed write', async () => {
		const adapter: LocalStorageAdapter = {
			loadLocalStorage: () => null,
			saveLocalStorage: () => {
				throw new Error('quota exceeded');
			},
		};

		await expect(
			new ContinueContextStore(adapter, KEY, logger).write({ projectId: 'p1', planId: null }),
		).resolves.toBeUndefined();
	});

	it('never throws on a failed read', async () => {
		const adapter: LocalStorageAdapter = {
			loadLocalStorage: () => {
				throw new Error('storage unavailable');
			},
			saveLocalStorage: () => undefined,
		};

		await expect(new ContinueContextStore(adapter, KEY, logger).read()).resolves.toBeNull();
	});

	it('logs a warning rather than staying silent when a write fails', async () => {
		resetRecorder();
		const spy = vi.spyOn(logger, 'warn');
		const adapter: LocalStorageAdapter = {
			loadLocalStorage: () => null,
			saveLocalStorage: () => {
				throw new Error('quota exceeded');
			},
		};

		await new ContinueContextStore(adapter, KEY, logger).write({ projectId: 'p1', planId: null });

		expect(spy).toHaveBeenCalledWith('continue-context.write-failed', expect.objectContaining({ cause: expect.any(Error) }));
		spy.mockRestore();
	});

	/**
	 * The property `SequenceMarkerFileStore`'s `KeyedQueues` exists to buy over an ASYNC
	 * adapter, checked here against the reason this store does not need one: `loadLocalStorage`/
	 * `saveLocalStorage` are synchronous, so two `write` calls made without an `await` between
	 * them — opening a project and then a plan inside it, which is precisely the flow Continue
	 * exists for, since `rememberContinue` answers `void` and every caller navigates in the same
	 * tick — cannot interleave: the first call's whole body, including its `saveLocalStorage`,
	 * runs to completion before the second call is even reached. No release function to control
	 * and nothing to yield on, because there is no async gap for a peer write to land inside.
	 */
	it('keeps the LATEST context when two writes are issued without awaiting the first', async () => {
		const { adapter } = fakeAdapter();
		const store = new ContinueContextStore(adapter, KEY, logger);

		const first = store.write({ projectId: 'p1', planId: null });
		const second = store.write({ projectId: 'p1', planId: 'plan-1' });
		await Promise.all([first, second]);

		expect(await store.read()).toEqual({ projectId: 'p1', planId: 'plan-1' });
	});

	/**
	 * The read-side twin: a read issued right after an UNAWAITED write already sees it, because
	 * the write's mutation happened synchronously before `write()` returned control at all. The
	 * navigate-then-remount sequence this guards is `rememberContinue`, navigate, the view
	 * remounts and reads — and there is no window between those in which the write could still
	 * be pending, unlike the file-backed design the plan this task was cut from specified.
	 */
	it('a read issued right after an unawaited write already sees it', async () => {
		const { adapter } = fakeAdapter();
		const store = new ContinueContextStore(adapter, KEY, logger);

		void store.write({ projectId: 'p1', planId: 'plan-1' });

		expect(await store.read()).toEqual({ projectId: 'p1', planId: 'plan-1' });
	});

	describe('clear', () => {
		it('writes null, so a following read answers null', async () => {
			const { adapter } = fakeAdapter();
			const store = new ContinueContextStore(adapter, KEY, logger);
			await store.write({ projectId: 'p1', planId: 'plan-1' });

			await store.clear({ projectId: 'p1', planId: 'plan-1' });

			expect(await store.read()).toBeNull();
		});

		/**
		 * The compare half, and the reason `clear` takes the context it VALIDATED rather than
		 * clearing whatever is there: this store is process-wide while the resolver that calls it
		 * (`ViewRoot`'s `resolveStored`) holds only a ticket local to its own instance, so another
		 * writer — the palette's plan open, another leaf's detail state, another `ViewRoot` — can
		 * land a newer target during the `getProject` await that decided the stale one was gone.
		 * Both fields are compared, because a Continue on the same project in a different plan is
		 * a different target.
		 */
		it.each([
			['a different project', { projectId: 'p2', planId: 'plan-1' }],
			['the same project in a different plan', { projectId: 'p1', planId: 'plan-2' }],
			['the same project with no plan', { projectId: 'p1', planId: null }],
		])('leaves a stored target alone when the validated one names %s', async (_what, expectedContext) => {
			const { adapter } = fakeAdapter();
			const store = new ContinueContextStore(adapter, KEY, logger);
			await store.write({ projectId: 'p1', planId: 'plan-1' });

			await store.clear(expectedContext);

			expect(await store.read()).toEqual({ projectId: 'p1', planId: 'plan-1' });
		});

		it('is a no-op against an empty store rather than a failure', async () => {
			const { adapter, entries } = fakeAdapter();
			const store = new ContinueContextStore(adapter, KEY, logger);

			await expect(store.clear({ projectId: 'p1', planId: null })).resolves.toBeUndefined();

			expect(entries.has(KEY)).toBe(false);
			expect(await store.read()).toBeNull();
		});

		it('logs rather than rejecting when the adapter throws', async () => {
			resetRecorder();
			const spy = vi.spyOn(logger, 'warn');
			// Stored value MATCHES, so the compare passes and the write this case is about is
			// actually reached: a mismatching one would never call `saveLocalStorage` at all and
			// the case would pass without exercising the swallow.
			const adapter: LocalStorageAdapter = {
				loadLocalStorage: () => ({ schemaVersion: 1, context: { projectId: 'p1', planId: null } }),
				saveLocalStorage: () => {
					throw new Error('quota exceeded');
				},
			};

			await expect(
				new ContinueContextStore(adapter, KEY, logger).clear({ projectId: 'p1', planId: null }),
			).resolves.toBeUndefined();

			expect(spy).toHaveBeenCalledWith('continue-context.clear-failed', expect.objectContaining({ cause: expect.any(Error) }));
			spy.mockRestore();
		});
	});
});
