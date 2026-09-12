// @vitest-environment jsdom
/**
 * The Property tree's reorder SEQUENCE FLAG (`PlanHierarchyStore.writing`) against the reads
 * that land around it: the Kind select greyed while a move writes, `writing` held until a read
 * that superseded the move's own re-read lands, and a superseding read that rejects left to its
 * starter. Split from `propertyTreeReorder.test.ts` by subject when that file crossed its line
 * cap; the rig is `tests/helpers/propertyTreeReorderRig.ts`.
 */
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defer } from '../../../helpers/async';
import { ok } from '../../../../src/core/result/Result';
import { t } from '../../../../src/presentation/i18n/strings';
import type { PlanHierarchyDto } from '../../../../src/presentation/read-models/planHierarchy';
import { usePlanHierarchyStore } from '../../../../src/presentation/stores/PlanHierarchyStore';
import * as notices from '../../../../src/presentation/notices/notify';
import { FIXTURE_PLAN } from '../../../helpers/planFixtures';
import { settle } from '../../../helpers/editor';
import { deferred, hierarchy, item, openTree as open, REFUSED, rig, unmountTrees } from '../../../helpers/propertyTreeReorderRig';

afterEach(unmountTrees);

describe('PropertyTree reordering, the sequence flag', () => {
	/**
	 * The Floor inspector's Kind select shares the sequence flag, and says so the way the menu does:
	 * `aria-disabled` titled "Saving" while a move is writing, a change dispatched nothing and the
	 * select keeps the saved kind, and once the re-read lands it is live again.
	 */
	it('greys the Kind select with the saving reason while a move is writing, and refuses a change visibly', async () => {
		const { execute, queries, commands } = rig();
		const release = deferred(execute);
		const harness = await open({ queries, commands });
		await settle();
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		const select = harness.wrapper.get('select[data-rp-field="plan-kind"]');
		expect(select.attributes('aria-disabled')).toBe('true');
		expect(select.attributes('title')).toBe(t('en', 'save-state.saving'));
		await select.setValue('building');
		await settle();
		expect(execute.mock.calls.map(([input]) => input)).toEqual([{ planId: 'plan-attic', order: 1 }]);
		expect((select.element as HTMLSelectElement).value).toBe(FIXTURE_PLAN.kind);
		release();
		await settle();
		expect(select.attributes('aria-disabled')).toBeUndefined();
		expect(select.attributes('title')).toBeUndefined();
	});

	/**
	 * Latest-wins can SUPERSEDE the move's own re-read: another leaf's event starts a load after it,
	 * the move's `load` returns with the older tree still on screen, and `writing` used to clear
	 * there — the next accepted Alt+↑ then computed from a tree older than the write it followed.
	 * `write()` holds the flag until no read is in flight at all.
	 */
	it('holds writing until a read that superseded the move\'s own re-read has landed', async () => {
		const { queries, commands } = rig();
		const harness = await open({ queries, commands });
		await settle();
		const reads: Array<(value: ReturnType<typeof ok<PlanHierarchyDto>>) => void> = [];
		queries.hierarchy.mockImplementation(() => new Promise((resolve) => { reads.push(resolve); }));
		const store = usePlanHierarchyStore(harness.pinia);
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await settle();
		expect(store.writing).toBe(true);
		harness.changeProjectPlans(FIXTURE_PLAN.projectId);
		await settle();
		expect(reads).toHaveLength(2);
		reads[0](ok(hierarchy()));
		await settle();
		expect(store.writing).toBe(true);
		reads[1](ok(hierarchy()));
		await settle();
		expect(store.writing).toBe(false);
	});

	/**
	 * And when the read that superseded it REJECTS, that is its starter's fault to report, not the
	 * move's: `settled()` resolves through it, so `writing` clears and nothing escapes into the
	 * `void reorder.moveUp(…)` a key press dispatches. Watched red first: without the swallow the
	 * run fails on an unhandled `Error: boom` after this case reports green, which is exactly the
	 * shape a `void` call leaves — the case itself cannot see it, vitest's run can. The Kind
	 * select's refused change is put back the same way afterwards; measured, that half stays green
	 * even without the swallow, because the `busy` flip re-renders the select and Vue re-patches a
	 * `value` prop on every render — so the assertion is about the behaviour, not the mechanism.
	 */
	it('clears writing and leaves a superseding read\'s rejection to its starter, mid-move and mid-Kind-change', async () => {
		const { execute, queries, commands } = rig();
		const notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		onTestFinished(() => notify.mockRestore());
		const harness = await open({ queries, commands });
		await settle();
		const store = usePlanHierarchyStore(harness.pinia);
		// The newer read must still be IN FLIGHT when `write()` reaches `settled()`: the move's own
		// re-read lands first, `write()` waits on the newer one, and only then does it reject.
		const supersede = (): ((cause: Error) => void) => {
			let abort!: (cause: Error) => void;
			const read = new Promise<ReturnType<typeof ok<PlanHierarchyDto>>>((_resolve, reject) => { abort = reject; });
			store.load({ ...queries, hierarchy: () => read }, FIXTURE_PLAN.id).catch(() => undefined);
			return abort;
		};
		let own = defer<ReturnType<typeof ok<PlanHierarchyDto>>>();
		queries.hierarchy.mockImplementationOnce(() => own.promise);
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await settle();
		expect(store.writing).toBe(true);
		let reject = supersede();
		own.resolve(ok(hierarchy()));
		await settle();
		expect(store.writing).toBe(true);
		reject(new Error('boom'));
		await settle();
		expect(store.writing).toBe(false);

		execute.mockResolvedValueOnce(REFUSED);
		own = defer<ReturnType<typeof ok<PlanHierarchyDto>>>();
		queries.hierarchy.mockImplementationOnce(() => own.promise);
		const select = harness.wrapper.get('select[data-rp-field="plan-kind"]');
		await select.setValue('building');
		await settle();
		expect(store.writing).toBe(true);
		reject = supersede();
		own.resolve(ok(hierarchy()));
		await settle();
		reject(new Error('boom'));
		await settle();
		expect(store.writing).toBe(false);
		expect(notify).toHaveBeenCalledOnce();
		expect((select.element as HTMLSelectElement).value).toBe(FIXTURE_PLAN.kind);
	});

	/**
	 * The move's OWN re-read can throw as well — a vault fault under `queries.hierarchy` — and that
	 * one is `write()`'s to report, since it started it: through `notifyFault`, the door
	 * `PlanEditorRoot.loadHierarchy` takes for the reads it starts. Watched red first: without the
	 * catch `notifyFault` is called 0 times and vitest's run fails on an unhandled `Error: boom`
	 * from the `void reorder.moveUp(…)` a key press dispatches — the shape a `void` call leaves,
	 * which the case cannot see and the run can.
	 */
	it('reports a re-read of its own that throws, once, clears writing and resets the Kind select', async () => {
		const { queries, commands } = rig();
		const fault = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		onTestFinished(() => fault.mockRestore());
		const harness = await open({ queries, commands });
		await settle();
		const store = usePlanHierarchyStore(harness.pinia);
		queries.hierarchy.mockImplementationOnce(() => Promise.reject(new Error('boom')));
		await item(harness, 'plan-attic').trigger('keydown', { key: 'ArrowUp', altKey: true });
		await settle();
		expect(fault).toHaveBeenCalledOnce();
		expect(store.writing).toBe(false);

		queries.hierarchy.mockImplementationOnce(() => Promise.reject(new Error('boom')));
		const select = harness.wrapper.get('select[data-rp-field="plan-kind"]');
		await select.setValue('building');
		await settle();
		expect(fault).toHaveBeenCalledTimes(2);
		expect(store.writing).toBe(false);
		expect((select.element as HTMLSelectElement).value).toBe(FIXTURE_PLAN.kind);
	});
});
