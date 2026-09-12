/**
 * `PlanHierarchyStore` (ADR-0028) in isolation: what `load` does with a query stack that
 * answers slowly, fails, or is simply absent — the three arms `usePlanHierarchyStore`'s own
 * ponytail comment names and `coverage-final.json` first showed untested.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { err, ok } from '../../../src/core/result/Result';
import { usePlanHierarchyStore } from '../../../src/presentation/stores/PlanHierarchyStore';
import { NO_HIERARCHY, type PlanHierarchyDto } from '../../../src/presentation/read-models/planHierarchy';
import { fakeQueries, FIXTURE_PLAN } from '../../helpers/planFixtures';
import { defer } from '../../helpers/async';

const HOUSE: PlanHierarchyDto = { ancestry: [{ id: 'plan-site', name: 'Site', kind: 'floor' }], detailPlans: [], tree: [], parentZone: null, parentZoneMissing: false };
const SITE: PlanHierarchyDto = { ancestry: [], detailPlans: [], tree: [], parentZone: null, parentZoneMissing: false };
const READ_FAILED = { category: 'Persistence', code: 'vault.unexpected-failure', message: 'boom' } as const;

describe('PlanHierarchyStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('starts at NO_HIERARCHY and loads what the query answers', async () => {
		const store = usePlanHierarchyStore();
		expect(store.hierarchy).toEqual(NO_HIERARCHY);

		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(HOUSE)) }, FIXTURE_PLAN.id);

		expect(store.hierarchy).toEqual(HOUSE);
	});

	it('does nothing when the composition supplies no hierarchy query, and settled resolves at once', async () => {
		const store = usePlanHierarchyStore();
		await store.load(fakeQueries(FIXTURE_PLAN), FIXTURE_PLAN.id);
		await store.settled();
		expect(store.hierarchy).toEqual(NO_HIERARCHY);
	});

	/**
	 * `settled` is what `usePlanReorder.write()` holds `writing` on: the caller's own `load` can be
	 * superseded by a read started after it, and resolving then would let the next move compute
	 * from the older tree. It waits for the newer read too — however the older one lands.
	 */
	it('settled waits for a read that superseded the caller\'s own, not only for that one', async () => {
		const store = usePlanHierarchyStore();
		const first = defer<ReturnType<typeof ok<PlanHierarchyDto>>>(), second = defer<ReturnType<typeof ok<PlanHierarchyDto>>>();
		const firstLoad = store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => first.promise }, 'plan-house');
		void store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => second.promise }, 'plan-site');
		let done = false;
		const waiting = (async () => { await store.settled(); done = true; })();

		first.resolve(ok(HOUSE));
		await firstLoad;
		expect(done).toBe(false);
		expect(store.hierarchy).toEqual(NO_HIERARCHY);

		second.resolve(ok(SITE));
		await waiting;
		expect(done).toBe(true);
		expect(store.hierarchy).toEqual(SITE);
	});

	/**
	 * A newer read that REJECTS — the query threw rather than answering a failed Result — is its
	 * starter's fault to report; `settled` resolves through it rather than handing the rejection to
	 * a writer that never started that read. Watched failing first: without the swallow this case
	 * dies on `await store.settled()` with the read's own error.
	 */
	it('settled resolves through a superseding read that rejects, leaving the fault to whoever started it', async () => {
		const store = usePlanHierarchyStore();
		const own = defer<ReturnType<typeof ok<PlanHierarchyDto>>>();
		let rejectNewer!: (cause: Error) => void;
		const newer = new Promise<ReturnType<typeof ok<PlanHierarchyDto>>>((_resolve, reject) => { rejectNewer = reject; });
		const ownLoad = store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => own.promise }, 'plan-house');
		const newerLoad = store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => newer }, 'plan-site');
		const waiting = store.settled();

		own.resolve(ok(HOUSE));
		await ownLoad;
		rejectNewer(new Error('boom'));
		await expect(newerLoad).rejects.toThrow('boom');
		await expect(waiting).resolves.toBeUndefined();
		expect(store.hierarchy).toEqual(NO_HIERARCHY);
	});

	/**
	 * A failed read keeps the last answer on screen AND says it failed: a detail plan whose
	 * hierarchy could not be read must not pass for a parentless plan (PBI guarantee).
	 */
	it('keeps the previous hierarchy when a later read fails, flags the failure, and clears it on the next success', async () => {
		const store = usePlanHierarchyStore();
		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(HOUSE)) }, FIXTURE_PLAN.id);
		expect(store.failed).toBe(false);

		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(err(READ_FAILED)) }, FIXTURE_PLAN.id);
		expect(store.hierarchy).toEqual(HOUSE);
		expect(store.failed).toBe(true);

		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(SITE)) }, FIXTURE_PLAN.id);
		expect(store.failed).toBe(false);
	});

	it('does not let an older failing read, resolving late, flag a newer successful one', async () => {
		const store = usePlanHierarchyStore();
		const first = defer<ReturnType<typeof err<typeof READ_FAILED>>>();
		const firstLoad = store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => first.promise }, 'plan-house');
		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(SITE)) }, 'plan-site');
		first.resolve(err(READ_FAILED));
		await firstLoad;
		expect(store.failed).toBe(false);
	});

	/** A slower earlier read must never land over a later one — `load`'s own request counter. */
	it('drops a stale answer that resolves after a newer request already landed', async () => {
		const store = usePlanHierarchyStore();
		const first = defer<ReturnType<typeof ok<PlanHierarchyDto>>>();

		const firstLoad = store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => first.promise }, 'plan-house');
		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(SITE)) }, 'plan-site');
		expect(store.hierarchy).toEqual(SITE);

		first.resolve(ok(HOUSE));
		await firstLoad;

		expect(store.hierarchy).toEqual(SITE);
	});
});
