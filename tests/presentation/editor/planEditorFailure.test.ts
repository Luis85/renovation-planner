/**
 * @vitest-environment jsdom
 *
 * Design slice 17's two in-place states in the Plan Editor — the second of the two cases
 * slice 14 deferred to that slice, plus the one it deferred that is not an error at all.
 *
 * Two defects close here rather than one. The `failed` arm rendered a FIXED sentence
 * (`editor.plan-failed`), so unrecovered settings and a vault fault told the user the same
 * thing — the defect slice 11 fixed in the Renovation Project view and never carried across.
 * And neither arm offered the user anything to do.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { err, ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { fakeQueries, mountPlanEditor } from '../../helpers/editor';
import { FIXTURE_PLAN } from '../../helpers/planFixtures';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import * as policy from '../../../src/presentation/errors/errorSurfacePolicy';
import type { PlanEditorQueryServices } from '../../../src/presentation/read-models/planEditorQueries';
import type { AppError } from '../../../src/core/errors/AppError';

const HYDRATION_FAULT: AppError = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'io',
};

const UNRECOVERED: AppError = {
	category: 'Persistence',
	code: 'settings.unrecovered',
	message: 'no settings',
};

/**
 * A query stack whose plan read refuses, leaving the store `failed`.
 *
 * Built by overriding ONE member of the shared `fakeQueries` rather than by declaring the two
 * this file happens to touch — the first draft did the latter and every mount logged
 * `context.queries.listAssets is not a function` underneath passing assertions, with one of
 * its two members named for a method the interface does not have.
 */
function refusingPlan(error: AppError, onCall?: () => void): PlanEditorQueryServices {
	const getPlan = () => {
		onCall?.();
		return Promise.resolve(err(error));
	};
	return { ...fakeQueries(null), getPlan };
}

/**
 * The dangling case needs no override at all: `fakeQueries(null)` answers `ok(null)`, which is
 * exactly what `GetPlan` returns for a plan that is not in the vault — a SUCCESS reporting an
 * absence, never an error.
 */
const danglingPlan = (): PlanEditorQueryServices => fakeQueries(null);

const failureEl = (harness: Awaited<ReturnType<typeof mountPlanEditor>>, part = '') =>
	harness.wrapper.find(`.rp-view-failure${part}`);

describe('the Plan Editor, when its plan cannot be shown', () => {
	it('says which failure it hit, rather than one sentence for every cause', async () => {
		// The defect this closes, asserted as a DIFFERENCE. A single expected string would pass
		// against the fixed sentence that was here before.
		const fault = await mountPlanEditor({ queries: refusingPlan(HYDRATION_FAULT) });
		await flushPromises();
		const faultBody = failureEl(fault, '__body').text();
		fault.wrapper.unmount();

		const settings = await mountPlanEditor({ queries: refusingPlan(UNRECOVERED) });
		await flushPromises();
		const settingsBody = failureEl(settings, '__body').text();
		settings.wrapper.unmount();

		expect(faultBody).not.toBe(settingsBody);
	});

	it('offers a retry for a read that really failed, and re-runs the query', async () => {
		let calls = 0;
		const harness = await mountPlanEditor({
			queries: refusingPlan(HYDRATION_FAULT, () => {
				calls += 1;
			}),
		});
		await flushPromises();
		expect(calls).toBe(1);

		await failureEl(harness, '__action').trigger('click');
		await flushPromises();

		expect(calls).toBe(2);
		// The mirror of the dangling case: a retryable failure re-reads and must NOT close the
		// tab out from under the user.
		expect(harness.closedLeaf()).toBe(0);
		harness.wrapper.unmount();
	});

	it('withholds the retry when the session composed nothing to re-run', async () => {
		const harness = await mountPlanEditor({ queries: refusingPlan(UNRECOVERED) });
		await flushPromises();

		expect(failureEl(harness).exists()).toBe(true);
		expect(failureEl(harness, '__action').exists()).toBe(false);
		harness.wrapper.unmount();
	});
});

describe('the Plan Editor, when its plan is simply gone', () => {
	it('offers to close the tab, and closes it', async () => {
		// The one useful action. There is nothing to retry — the query SUCCEEDED and reported an
		// absence — so a retry button here would re-ask a question already answered.
		let calls = 0;
		const counting: PlanEditorQueryServices = {
			...fakeQueries(null),
			getPlan: () => {
				calls += 1;
				return Promise.resolve(ok(null));
			},
		};
		const harness = await mountPlanEditor({ queries: counting });
		await flushPromises();
		expect(calls).toBe(1);

		expect(failureEl(harness, '__action').text()).toBe(t('en', 'editor.plan-missing.action'));
		await failureEl(harness, '__action').trigger('click');
		await flushPromises();

		expect(harness.closedLeaf()).toBe(1);
		// And it did NOT re-run the query: the two states share one button and mean opposite
		// things by it, so a handler that always re-hydrated would look right here and be wrong.
		expect(calls).toBe(1);

		harness.wrapper.unmount();
	});

	it('says the tab points at a plan that no longer exists', async () => {
		const harness = await mountPlanEditor({ queries: danglingPlan() });
		await flushPromises();

		expect(failureEl(harness, '__headline').text()).toBe(t('en', 'editor.plan-missing.headline'));
		expect(failureEl(harness, '__body').text()).toBe(t('en', 'editor.plan-missing.body'));
		harness.wrapper.unmount();
	});

	/**
	 * **The absence, pinned.** `GetPlan` resolving `ok(null)` is not an error: the query
	 * succeeded and correctly reported that nothing resolves. So it reaches no error surface,
	 * and `surfaceFor` is never called for it.
	 *
	 * An absence nothing asserts is indistinguishable from an omission, which is why this case
	 * exists rather than being left to the reader of the component. A later edit that starts
	 * routing this through the table — manufacturing a category for it, which is precisely the
	 * "map everything to a generic DomainError" mistake slice 11 warns against, one layer up —
	 * fails here rather than passing quietly.
	 *
	 * **The spy was verified to BIND before this case was trusted**, because it might not have.
	 * `renovationProjectEmptyState.test.ts` records that instrument failing on a different
	 * surface — "a compiled `<script setup>` closes over the imported identifier directly, not
	 * through a property lookup a spy on the module namespace can intercept" — and a spy that
	 * binds to nothing reports `not.toHaveBeenCalled()` for every build ever written. Measured
	 * by running the same spy against a FAILED read, where `surfaceFor` is genuinely reached:
	 * it was called. So the two arms differ under this instrument, which is what makes the
	 * absence here evidence rather than a tautology.
	 */
	it('never routes a missing plan through the surface table, because it is not an error', async () => {
		const spy = vi.spyOn(policy, 'surfaceFor');

		const harness = await mountPlanEditor({ queries: danglingPlan() });
		await flushPromises();

		expect(failureEl(harness).exists()).toBe(true);
		expect(spy).not.toHaveBeenCalled();

		spy.mockRestore();
		harness.wrapper.unmount();
	});
});

describe('the Plan Editor, when a post-write refresh fails', () => {
	it('keeps the canvas and says the view may be out of date', async () => {
		// `keepPreviousOnFailure` is how every post-command refresh reads back: a failed read
		// leaves `status === 'ready'` with the previous scene drawn and an `error` recorded.
		// Nothing rendered that pair, so the indicator said Saved over a canvas quietly showing
		// pre-command geometry.
		let call = 0;
		const flaky: PlanEditorQueryServices = {
			...fakeQueries(FIXTURE_PLAN),
			getPlan: () => {
				call += 1;
				return call === 1
					? Promise.resolve(ok(FIXTURE_PLAN))
					: Promise.resolve(
							err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' }),
						);
			},
		};
		const harness = await mountPlanEditor({ queries: flaky });
		await flushPromises();
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);

		// A second hydrate, the shape `withEditorStateRefresh` performs after a committed write.
		const store = useProjectStore(harness.pinia);
		await store.hydrate(flaky, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		await flushPromises();

		// ADDITIVE: the canvas stays, because the data it draws is valid — only stale.
		expect(harness.wrapper.find('.rp-plan-canvas').exists()).toBe(true);
		expect(harness.wrapper.find('.rp-view-failure').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-editor-notice').text()).toBe(t('en', 'editor.refresh-failed'));

		harness.wrapper.unmount();
	});

	it('keeps saying so while the next read is in flight, and stops only when one succeeds', async () => {
		// `hydrate` used to clear `error` unconditionally at its top while leaving
		// `status === 'ready'`, so the strip vanished for the whole of the next read — over a
		// canvas still drawing the same stale snapshot. A read that has STARTED has established
		// nothing. Reported by a review bot.
		let resolveSecond: ((value: Awaited<ReturnType<PlanEditorQueryServices['getPlan']>>) => void) | null =
			null;
		let call = 0;
		const flaky: PlanEditorQueryServices = {
			...fakeQueries(FIXTURE_PLAN),
			getPlan: () => {
				call += 1;
				if (call === 1) return Promise.resolve(ok(FIXTURE_PLAN));
				if (call === 2) return Promise.resolve(err(HYDRATION_FAULT));
				// The third read is held open, which is the window the defect lived in.
				return new Promise((resolve) => {
					resolveSecond = resolve;
				});
			},
		};
		const harness = await mountPlanEditor({ queries: flaky });
		await flushPromises();
		const store = useProjectStore(harness.pinia);

		await store.hydrate(flaky, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		await flushPromises();
		expect(harness.wrapper.find('.rp-editor-notice').text()).toBe(t('en', 'editor.refresh-failed'));

		// A third refresh starts and does not resolve. The canvas is showing exactly what it was
		// showing a moment ago, so the warning has to stand.
		const inFlight = store.hydrate(flaky, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		await flushPromises();
		expect(harness.wrapper.find('.rp-editor-notice').text()).toBe(t('en', 'editor.refresh-failed'));

		// And it retires on the one event that earns it: a read that came back.
		resolveSecond?.(ok(FIXTURE_PLAN));
		await inFlight;
		await flushPromises();
		expect(harness.wrapper.find('.rp-editor-notice').exists()).toBe(false);

		harness.wrapper.unmount();
	});

	it('does not swallow the background notice, which is about something else entirely', async () => {
		// The two BACKGROUND notices are alternatives to each other — a background is missing or
		// unreadable, never both — so they are one `v-if`/`v-else-if` chain. Staleness is an
		// independent fact about a re-READ, and the strip first shipped as the head of that same
		// chain: a failed read-back then suppressed the only sentence explaining why the plan had
		// no background, leaving the survivor one that says nothing about it. Reported by a
		// review bot.
		let call = 0;
		const flaky: PlanEditorQueryServices = {
			...fakeQueries(FIXTURE_PLAN),
			getPlan: () => {
				call += 1;
				return call === 1 ? Promise.resolve(ok(FIXTURE_PLAN)) : Promise.resolve(err(HYDRATION_FAULT));
			},
		};
		const harness = await mountPlanEditor({ queries: flaky });
		await flushPromises();

		// The canvas reports what it found where the background should have been. Emitted rather
		// than fixtured, because `backgroundStatus` is a ref the canvas writes through this event
		// and there is no other door to it.
		const canvas = harness.wrapper.findComponent({ name: 'PlanCanvas' });
		canvas.vm.$emit('background-status', 'missing');
		await flushPromises();

		const store = useProjectStore(harness.pinia);
		await store.hydrate(flaky, FIXTURE_PLAN.id, { keepPreviousOnFailure: true });
		await flushPromises();

		// BOTH, in order. Asserted as the whole list rather than by picking one out, because
		// `find` answers the first match and would have been satisfied by the defect.
		expect(harness.wrapper.findAll('.rp-editor-notice').map((el) => el.text())).toStrictEqual([
			t('en', 'editor.refresh-failed'),
			t('en', 'editor.background-missing'),
		]);

		harness.wrapper.unmount();
	});
});
