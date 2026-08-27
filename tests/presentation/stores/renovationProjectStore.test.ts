/**
 * `RenovationProjectStore` in isolation (design slice 14).
 *
 * Node, not jsdom — the same reasoning `stores.test.ts` gives for `ProjectStore`: a store is
 * plain reactive state, and needing a DOM to test one would mean the persistent/ephemeral
 * split had leaked into a component. The view-level behaviour (what actually renders) is
 * `tests/presentation/views/renovationProjectEmptyState.test.ts`'s job; this file is about
 * the three requirements the task brief calls out for the store itself.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { useRenovationProjectStore } from '../../../src/presentation/stores/RenovationProjectStore';
import type { RenovationProjectQueryServices } from '../../../src/presentation/read-models/renovationProjectQueries';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const PROJECT: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning' };
const READ_FAILED = { category: 'Persistence', code: 'settings.unrecovered', message: 'boom' } as const;

function queries(overrides: Partial<RenovationProjectQueryServices> = {}): RenovationProjectQueryServices {
	return {
		listProjects: () => Promise.resolve(ok([PROJECT])),
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('RenovationProjectStore hydration', () => {
	it('starts idle, holding nothing', () => {
		const store = useRenovationProjectStore();

		expect(store.status).toBe('idle');
		expect(store.projects).toEqual([]);
		expect(store.emptyStateKey).toBeNull();
	});

	it('loads the project list', async () => {
		const store = useRenovationProjectStore();

		await store.hydrate(queries());

		expect(store.status).toBe('ready');
		expect(store.projects).toEqual([PROJECT]);
	});

	/**
	 * Requirement 2: a failed read leaves no stale list behind. `fail` is what states this
	 * rule for `ProjectStore` too — drawing a list beside an error saying it could not be
	 * read is the worse of the two wrong answers.
	 */
	it('a failed read empties the list rather than keeping what it had', async () => {
		const store = useRenovationProjectStore();
		await store.hydrate(queries());
		expect(store.projects).toEqual([PROJECT]);

		await store.hydrate(queries({ listProjects: () => Promise.resolve(err(READ_FAILED)) }));

		expect(store.status).toBe('failed');
		expect(store.projects).toEqual([]);
		expect(store.error).toEqual(READ_FAILED);
	});

	/**
	 * Requirement 3, DoD 6's structural half: `emptyStateKey` cannot answer anything but
	 * `null` for any status other than `'ready'`, so a failed read is never rendered as an
	 * empty state regardless of what calls the selector or when.
	 */
	it('never computes an empty-state key for a failed read, even with an empty project list', async () => {
		const store = useRenovationProjectStore();

		await store.hydrate(queries({ listProjects: () => Promise.resolve(err(READ_FAILED)) }));

		expect(store.status).toBe('failed');
		expect(store.projects).toEqual([]);
		expect(store.emptyStateKey).toBeNull();
	});

	it('resolves the empty-state key once ready with no projects', async () => {
		const store = useRenovationProjectStore();

		await store.hydrate(queries({ listProjects: () => Promise.resolve(ok([])) }));

		expect(store.status).toBe('ready');
		expect(store.emptyStateKey).toBe('noProjects');
	});

	/**
	 * Requirement 1: the hydration ticket. There is one caller today, but `ProjectStore`
	 * carried this same mechanism through a slice where it had one caller too and gained a
	 * second later — a slower earlier read landing on top of a fresher later one is a
	 * just-created project vanishing with no error anywhere, and it happens on the very
	 * first overlapping pair of calls rather than some later one a reviewer can catch in
	 * time.
	 */
	it('a SLOW earlier hydration does not overwrite a faster later one', async () => {
		const store = useRenovationProjectStore();

		let releaseSlow!: () => void;
		const slowGate = new Promise<void>((resolve) => {
			releaseSlow = resolve;
		});
		const stale: ProjectSummaryDto = { id: 'stale', name: 'the stale answer', status: 'Planning' };
		const slow = store.hydrate(queries({ listProjects: () => slowGate.then(() => ok([stale])) }));

		// A second hydration starts and finishes entirely inside the first one's await.
		const fresh: ProjectSummaryDto = { id: 'fresh', name: 'the fresh answer', status: 'Planning' };
		await store.hydrate(queries({ listProjects: () => Promise.resolve(ok([fresh])) }));
		expect(store.projects).toEqual([fresh]);

		releaseSlow();
		await slow;

		expect(store.projects).toEqual([fresh]);
	});

	it('a reset invalidates a hydration still in flight', async () => {
		const store = useRenovationProjectStore();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const pending = store.hydrate(queries({ listProjects: () => gate.then(() => ok([PROJECT])) }));

		store.reset();
		release();
		await pending;

		expect(store.projects).toEqual([]);
		expect(store.status).toBe('idle');
	});

	it('is fully rebuildable — a reset returns it to its opening state', async () => {
		const store = useRenovationProjectStore();
		await store.hydrate(queries());

		store.reset();

		expect(store.status).toBe('idle');
		expect(store.projects).toEqual([]);
		expect(store.error).toBeNull();
	});
});
