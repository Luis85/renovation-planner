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

const HOUSE: PlanHierarchyDto = { ancestry: [{ id: 'plan-site', name: 'Site' }], detailPlans: [], parentZone: null, parentZoneMissing: false };
const SITE: PlanHierarchyDto = { ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: false };
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

	it('does nothing when the composition supplies no hierarchy query', async () => {
		const store = usePlanHierarchyStore();
		await store.load(fakeQueries(FIXTURE_PLAN), FIXTURE_PLAN.id);
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
