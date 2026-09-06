import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';
import { defer } from '../../helpers/async';
describe('unexpected projection read faults', () => {
 it('reports initial failures and retains the last valid scene after a thrown read-back', async () => {
  setActivePinia(createPinia()); const store = useProjectStore(), queries = fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES);
  const broken = { ...queries, getPlan: () => Promise.reject(new Error('disk')) };
  await store.hydrate(broken, FIXTURE_PLAN.id); expect(store.status).toBe('failed'); expect(store.refreshing).toBe(false);
  await store.hydrate(queries, FIXTURE_PLAN.id); const previous = store.zones;
  await store.hydrate(broken, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
  expect(store.zones).toBe(previous); expect(store.stale).toBe(true); expect(store.refreshing).toBe(false);
  await store.hydrate(queries, FIXTURE_PLAN.id, { keepPreviousOnFailure: true }); expect(store.stale).toBe(false);
 });
 it('ignores a rejection after the editor cancels its hydration', async () => {
  setActivePinia(createPinia()); const store = useProjectStore(), pending = defer<void>(), queries = fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES);
  await store.hydrate(queries, FIXTURE_PLAN.id); const previous = store.zones;
  const reading = store.hydrate({ ...queries, getPlan: () => pending.promise.then(() => { throw new Error('late read'); }) }, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
  store.cancelHydration(); pending.resolve(undefined); await reading;
  expect(store.zones).toBe(previous); expect(store.stale).toBe(false); expect(store.refreshing).toBe(false);
 });
});
