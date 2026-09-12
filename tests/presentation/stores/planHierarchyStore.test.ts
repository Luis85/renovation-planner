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

	it('does nothing when the composition supplies no hierarchy query', async () => {
		const store = usePlanHierarchyStore();
		await store.load(fakeQueries(FIXTURE_PLAN), FIXTURE_PLAN.id);
		expect(store.hierarchy).toEqual(NO_HIERARCHY);
	});

	/**
	 * The ponytail comment on `load`: a failed read keeps the last answer rather than blanking
	 * it, because the breadcrumb and guide are additive and the plan's own read already reports
	 * a vault fault.
	 */
	it('keeps the previous hierarchy when a later read fails', async () => {
		const store = usePlanHierarchyStore();
		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(ok(HOUSE)) }, FIXTURE_PLAN.id);

		await store.load({ ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(err(READ_FAILED)) }, FIXTURE_PLAN.id);

		expect(store.hierarchy).toEqual(HOUSE);
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
