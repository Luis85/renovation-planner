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

const PROJECT: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning', currency: 'EUR', libraryOverlap: false };
const READ_FAILED = { category: 'Persistence', code: 'settings.unrecovered', message: 'boom' } as const;

/**
 * `getProject` and `listPlansByProject` are design slice 21's detail-state doors, and this
 * store never calls either — `RenovationProjectStore` holds the LIST, and the detail state is
 * `ProjectDetailStore`'s. They ANSWER rather than refuse for CLAUDE.md's fifth
 * fake-instance reason: a stand-in that refuses what production would answer shows a false
 * picture, and there is no unavailable session being modelled here — every case in this file
 * that wants a refusal spells it on `listProjects`, which is the door it is about.
 * `ok(null)` is "no such project", which is the answer this bundle's own one-project vault
 * gives for any id but `PROJECT`'s.
 */
function queries(overrides: Partial<RenovationProjectQueryServices> = {}): RenovationProjectQueryServices {
	return {
		listProjects: () => Promise.resolve(ok({ projects: [PROJECT], unreadable: 0 })),
		getProject: () => Promise.resolve(ok(null)),
		listPlansByProject: () => Promise.resolve(ok({ plans: [], unreadable: 0 })),
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
	 *
	 * The refusal COUNT is under the same rule and is asserted here for that reason: a
	 * wholesale failure has no per-note count behind it, so a `1` surviving from the read
	 * before it would be rendered as a fact about a read that never happened. The preceding
	 * hydration therefore carries a non-zero count, or this assertion would pass against a
	 * `fail` that resets nothing.
	 */
	it('a failed read empties the list rather than keeping what it had', async () => {
		const store = useRenovationProjectStore();
		await store.hydrate(
			queries({ listProjects: () => Promise.resolve(ok({ projects: [PROJECT], unreadable: 1 })) }),
		);
		expect(store.projects).toEqual([PROJECT]);
		expect(store.unreadable).toBe(1);

		await store.hydrate(queries({ listProjects: () => Promise.resolve(err(READ_FAILED)) }));

		expect(store.status).toBe('failed');
		expect(store.projects).toEqual([]);
		expect(store.unreadable).toBe(0);
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

		await store.hydrate(queries({ listProjects: () => Promise.resolve(ok({ projects: [], unreadable: 0 })) }));

		expect(store.status).toBe('ready');
		expect(store.emptyStateKey).toBe('noProjects');
	});

	/**
	 * Design slice 16's post-command refresh (`ViewRoot.onCreateProject`) is the second
	 * caller this store's own docblock predicted — a re-hydration of an already-`'ready'`
	 * view. Without the guard, `status` swings through `'loading'` for the tick the second
	 * read is in flight, which drops `emptyStateKey` to `null` and back: the empty state
	 * blinks out and back in on every successful create. Observed ACROSS the await (not
	 * just after it resolves), because a status that flips to `'loading'` and back to
	 * `'ready'` before this test ever reads it would pass this assertion for the wrong
	 * reason if it only checked the end state.
	 */
	it('does not drop back to loading on a re-hydration of an already-ready store', async () => {
		const store = useRenovationProjectStore();
		await store.hydrate(queries());
		expect(store.status).toBe('ready');

		let releaseSecond!: () => void;
		const gate = new Promise<void>((resolve) => {
			releaseSecond = resolve;
		});
		const second = store.hydrate(
			queries({ listProjects: () => gate.then(() => ok({ projects: [PROJECT], unreadable: 0 })) }),
		);

		// The second read has started (its `listProjects` is already pending on `gate`) but
		// has not resolved — exactly the window the unguarded store spent at `'loading'`.
		expect(store.status).toBe('ready');

		releaseSecond();
		await second;

		expect(store.status).toBe('ready');
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
		const stale: ProjectSummaryDto = { id: 'stale', name: 'the stale answer', status: 'Planning', currency: 'EUR', libraryOverlap: false };
		const slow = store.hydrate(
			queries({ listProjects: () => slowGate.then(() => ok({ projects: [stale], unreadable: 0 })) }),
		);

		// A second hydration starts and finishes entirely inside the first one's await.
		const fresh: ProjectSummaryDto = { id: 'fresh', name: 'the fresh answer', status: 'Planning', currency: 'EUR', libraryOverlap: false };
		await store.hydrate(queries({ listProjects: () => Promise.resolve(ok({ projects: [fresh], unreadable: 0 })) }));
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
		const pending = store.hydrate(
			queries({ listProjects: () => gate.then(() => ok({ projects: [PROJECT], unreadable: 0 })) }),
		);

		store.reset();
		release();
		await pending;

		expect(store.projects).toEqual([]);
		expect(store.status).toBe('idle');
	});

	/**
	 * "Its opening state" includes the refusal count, which is why the hydration this reset
	 * undoes carries a non-zero one: against a `reset` that leaves `unreadable` alone, a
	 * fixture reading `0` would assert nothing at all.
	 */
	it('is fully rebuildable — a reset returns it to its opening state', async () => {
		const store = useRenovationProjectStore();
		await store.hydrate(
			queries({ listProjects: () => Promise.resolve(ok({ projects: [PROJECT], unreadable: 4 })) }),
		);
		expect(store.unreadable).toBe(4);

		store.reset();

		expect(store.status).toBe('idle');
		expect(store.projects).toEqual([]);
		expect(store.unreadable).toBe(0);
		expect(store.error).toBeNull();
	});

	/**
	 * The count is the store's, not the view's, because `emptyStateKey` is computed from it:
	 * a vault of unreadable notes must not resolve to `noProjects`. Asserted on the store so
	 * the rule holds without a DOM.
	 */
	it('holds the refusal count and answers no empty state for a vault of unreadable notes', async () => {
		const store = useRenovationProjectStore();

		await store.hydrate(
			queries({ listProjects: () => Promise.resolve(ok({ projects: [], unreadable: 3 })) }),
		);

		expect(store.status).toBe('ready');
		expect(store.unreadable).toBe(3);
		expect(store.emptyStateKey).toBeNull();
	});

	it('forgets a refusal count on the next clean read', async () => {
		const store = useRenovationProjectStore();
		await store.hydrate(
			queries({ listProjects: () => Promise.resolve(ok({ projects: [], unreadable: 2 })) }),
		);

		await store.hydrate(
			queries({ listProjects: () => Promise.resolve(ok({ projects: [PROJECT], unreadable: 0 })) }),
		);

		expect(store.unreadable).toBe(0);
		expect(store.emptyStateKey).toBeNull();
	});
});
