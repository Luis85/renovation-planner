/**
 * @vitest-environment jsdom
 *
 * DISABLED WITH REASON, never hidden — extension 4a of
 * `docs/requirements/Bound the mobile surface to what it can actually do.md`: "a control that
 * vanishes on one device and appears on another reads as a bug in whichever one the user is
 * holding".
 *
 * Every control this surface used to drop under `v-if="!readOnly"` is asserted here as PRESENT,
 * disabled, and pointing at the one notice — a triple, because each half alone passes a
 * different wrong implementation: present-and-enabled is the bug the requirement is about,
 * disabled-with-no-reason is the silent refusal it forbids, and a `aria-describedby` resolving
 * to nothing is the failure `app-id-prefix.ts` exists to prevent and that no renderer reports.
 *
 * The desktop cases are the other direction and are not decoration: "with the platform reported
 * as desktop, nothing above applies and no control changes" is one of the note's four acceptance
 * criteria, and it is the one an over-eager guard breaks.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import { RENOVATION_PROJECT_CONTEXT, type RenovationProjectDeps, type ProjectSession } from '../../../src/presentation/views/RenovationProjectContext';
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';
import { ok } from '../../../src/core/result/Result';
import { createMoney } from '../../../src/core/money/Money';
import { tr } from '../../../src/presentation/i18n/strings';
import type { AssetPriceRowDto } from '../../../src/application/queries/ListProjectAssetPrices';
import type { AssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import type { ObservationToken } from '../../../src/application/ports/versioning';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

const project: ProjectSummaryDto = { id: 'p1', name: 'Kitchen refit', status: 'IDEA', currency: 'EUR', libraryOverlap: false, planCount: 1, lastWorked: null };
const plan = { id: 'plan1', name: 'Ground floor' };

function session(): ProjectSession {
	return { query: '', completedOpen: false, focusedProjectId: null, scrollTop: 0, guidanceHidden: false };
}

function priceRow(): AssetPriceRowDto {
	const price = createMoney('12.00', 'EUR');
	if (!price.ok) throw new Error('fixture');
	return { assetId: 'a1', assetName: 'Paint', assetStatus: 'known', catalogue: price.value, override: price.value, overrideId: 'o1' as AssetPriceOverrideId, overrideVersion: { revision: 1, observed: 'observed-1' as ObservationToken } };
}

const mounted: VueWrapper[] = [];
afterEach(() => { mounted.splice(0).forEach((wrapper) => wrapper.unmount()); });

function rig(over: Partial<RenovationProjectDeps> = {}) {
	const base = defaultRenovationProjectDeps();
	const pinia = createPinia();
	const context: RenovationProjectDeps = {
		...base,
		session: session(),
		navigate: vi.fn<RenovationProjectDeps['navigate']>(),
		openPlan: vi.fn<RenovationProjectDeps['openPlan']>(() => Promise.resolve('opened' as const)),
		queries: {
			...base.queries,
			listProjects: () => Promise.resolve(ok({ projects: [project], unreadable: 0 })),
			getProject: () => Promise.resolve(ok(project)),
			listPlansByProject: () => Promise.resolve(ok({ plans: [plan], unreadable: 0 })),
			listAssetPrices: () => Promise.resolve(ok([priceRow()])),
		},
		...over,
	};
	const wrapper = mount(ViewRoot, { attachTo: document.body, global: { plugins: [pinia], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } } });
	mounted.push(wrapper);
	return { wrapper, context };
}

/**
 * The whole assertion in one place, because "disabled" and "says why" are one claim: a control
 * asserted only on `disabled` passes the silent refusal the requirement forbids, and one asserted
 * only on `aria-describedby` passes a control that still writes.
 *
 * It resolves the id against the DOM rather than comparing two strings, which is the half that
 * catches the collision `app-id-prefix.ts` is about — a describedby naming an id no element in
 * this tree carries reads as a correct attribute and announces nothing.
 */
function refuses(wrapper: VueWrapper, selector: string): void {
	const control = wrapper.get(selector);
	const described = control.attributes('aria-describedby');

	expect(control.attributes('disabled') ?? control.attributes('aria-disabled')).toBeDefined();
	expect(described).toBeDefined();
	expect(wrapper.get(`#${String(described)}`).text()).toBe(tr('view.mobile.read-only'));
}

describe('the project surface on mobile', () => {
	it('draws one notice and refuses the list state’s own write controls', async () => {
		const { wrapper } = rig({ readOnly: true });
		await flushPromises();

		expect(wrapper.findAll('.rp-mobile-notice')).toHaveLength(1);
		expect(wrapper.get('.rp-mobile-notice').text()).toBe(tr('view.mobile.read-only'));
		refuses(wrapper, '.rp-project-list__create');
		refuses(wrapper, '.rp-view-aside__create-asset');
	});

	it('refuses the no-match create-named action rather than dropping it', async () => {
		const { wrapper } = rig({ readOnly: true, initialQuery: 'nothing matches this' });
		await flushPromises();

		refuses(wrapper, '.rp-project-list__create-named');
		// The other control in that block reads rather than writes, so nothing about it changes.
		expect(wrapper.get('.rp-project-list__clear-filter').attributes('disabled')).toBeUndefined();
	});

	it('refuses Resume for a stored plan while the projects around it stay open', async () => {
		const { wrapper, context } = rig({ readOnly: true, continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }) });
		await flushPromises();

		refuses(wrapper, '.rp-continue__resume');
		await wrapper.get('.rp-continue__open').trigger('click');
		expect(context.navigate).toHaveBeenCalledWith(project.id);
	});

	it('keeps the empty state’s action visible and refused', async () => {
		const base = defaultRenovationProjectDeps();
		const { wrapper } = rig({ readOnly: true, queries: { ...base.queries, listProjects: () => Promise.resolve(ok({ projects: [], unreadable: 0 })) } });
		await flushPromises();

		// The LABEL survives, which is the half `emptyActionLabel` used to drop: an empty state
		// whose action disappears reads as a state with nothing to do rather than as a refusal.
		expect(wrapper.get('.rp-empty-state__action').text()).not.toBe('');
		refuses(wrapper, '.rp-empty-state__action');
	});

	it('refuses the detail state’s plan controls and its plan entry', async () => {
		const { wrapper } = rig({ readOnly: true, projectId: project.id });
		await flushPromises();

		expect(wrapper.findAll('.rp-mobile-notice')).toHaveLength(1);
		refuses(wrapper, '.rp-plan-list__create');
		refuses(wrapper, '.rp-plan-list__row');
		refuses(wrapper, '.rp-project-detail__entry-action');
	});

	it('keeps the price field drawn and refused rather than absent', async () => {
		const { wrapper } = rig({ readOnly: true, projectId: project.id, section: 'prices' });
		await flushPromises();

		expect(wrapper.text()).toContain('12.00 EUR');
		refuses(wrapper, '.rp-asset-price-input');
		refuses(wrapper, '.rp-asset-price-clear');

		// `showDraftActions` is bare `dirty` and neither draft button carries `:disabled="readOnly"`,
		// so the pair is kept off this surface by `onPriceInput` returning early on `readOnly` and by
		// nothing else. The event is dispatched at the ELEMENT rather than through `setValue`,
		// because vue-test-utils declines to `trigger` on a disabled element — which is faithful to a
		// browser and is exactly why the outer guard hides the inner one: mutate the early return
		// with `setValue` here and this case stays green, measured.
		const field = wrapper.get('.rp-asset-price-input').element as HTMLInputElement;
		field.value = '9.00';
		field.dispatchEvent(new Event('input'));
		await flushPromises();

		expect(wrapper.find('.rp-asset-price-apply').exists()).toBe(false);
		expect(wrapper.find('.rp-asset-price-cancel').exists()).toBe(false);
	});
});

describe('the same surface on desktop', () => {
	it('draws no notice and disables nothing in the list state', async () => {
		const { wrapper } = rig();
		await flushPromises();

		expect(wrapper.find('.rp-mobile-notice').exists()).toBe(false);
		expect(wrapper.get('.rp-project-list__create').attributes('disabled')).toBeUndefined();
		expect(wrapper.get('.rp-project-list__create').attributes('aria-describedby')).toBeUndefined();
		expect(wrapper.get('.rp-view-aside__create-asset').attributes('disabled')).toBeUndefined();
	});

	it('draws no notice and disables nothing in the detail state', async () => {
		const { wrapper } = rig({ projectId: project.id });
		await flushPromises();

		expect(wrapper.find('.rp-mobile-notice').exists()).toBe(false);
		expect(wrapper.get('.rp-plan-list__create').attributes('disabled')).toBeUndefined();
		expect(wrapper.get('.rp-plan-list__row').attributes('disabled')).toBeUndefined();
		expect(wrapper.get('.rp-plan-list__row').attributes('aria-describedby')).toBeUndefined();
	});
});
