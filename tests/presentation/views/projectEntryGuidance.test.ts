/** @vitest-environment jsdom */
/**
 * The three ENTRY PATHS a project's detail state offers (design slice 22, task 1) — screens P01
 * and P02, `interaction-concept.md` §6–§7.
 *
 * Its own file rather than more cases in `projectExperience.test.ts`, which is already well into
 * its 450-line cap: the two cases there that touch this region assert that guidance is
 * OPTIONAL and that the core actions survive hiding it, which is a different question from what
 * the region draws and in which order.
 *
 * Driven through `ViewRoot` rather than by mounting `ProjectDetail` with props, because the two
 * facts these cases are about are ones the STATE derives: `isNew` from what the plan read
 * answered, and `lastPlan` from the stored continue context resolved against that same read.
 * `projectDetail.test.ts` is where the component is driven bare.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import ViewRoot from '../../../src/presentation/views/ViewRoot.vue';
import NewPlanForm from '../../../src/presentation/views/NewPlanForm.vue';
import { RENOVATION_PROJECT_CONTEXT, type RenovationProjectDeps, type ProjectSession } from '../../../src/presentation/views/RenovationProjectContext';
import { installObsidianDom } from '../../helpers/dom';
import { defaultRenovationProjectDeps } from '../../helpers/makeRenovationProjectView';
import { ok, err } from '../../../src/core/result/Result';
import type { ProjectSummaryDto } from '../../../src/presentation/read-models/PlanDto';

installObsidianDom();

const project: ProjectSummaryDto = { id: 'p1', name: 'Hallway', status: 'IDEA', currency: 'EUR', libraryOverlap: false, planCount: 0, lastWorked: null };
const plan = { id: 'plan1', name: 'Ground floor', kind: 'floor' as const };
const failure = err({ category: 'Persistence' as const, code: 'repository.read-failed', message: 'read failed' });
const session = (): ProjectSession => ({ query: '', completedOpen: false, focusedProjectId: null, scrollTop: 0, guidanceHidden: false });

const mounted: VueWrapper[] = [];
afterEach(() => { mounted.splice(0).forEach((wrapper) => wrapper.unmount()); });

type PlanListing = ReturnType<RenovationProjectDeps['queries']['listPlansByProject']>;

/** The detail state over a plan read this case chooses, with everything else the shared default. */
function rig(over: Partial<RenovationProjectDeps> = {}, listed: PlanListing = Promise.resolve(ok({ plans: [plan], unreadable: 0 }))) {
	const base = defaultRenovationProjectDeps();
	const context: RenovationProjectDeps = {
		...base,
		projectId: project.id,
		session: session(),
		navigate: vi.fn<RenovationProjectDeps['navigate']>(),
		openPlan: vi.fn<RenovationProjectDeps['openPlan']>(() => Promise.resolve('opened' as const)),
		queries: { ...base.queries, getProject: () => Promise.resolve(ok(project)), listPlansByProject: () => listed },
		...over,
	};
	const wrapper = mount(ViewRoot, { attachTo: document.body, global: { plugins: [createPinia()], provide: { [RENOVATION_PROJECT_CONTEXT as symbol]: context } } });
	mounted.push(wrapper);
	return { wrapper, context };
}

const titles = (wrapper: VueWrapper): string[] => wrapper.findAll('.rp-project-detail__entry-title').map((el) => el.text());
const actions = (wrapper: VueWrapper) => wrapper.findAll<HTMLButtonElement>('.rp-project-detail__entry-action');
/** §6's three ranks, read off the DOM rather than off the descriptor that produced them. */
const ranks = (wrapper: VueWrapper): string[] =>
	actions(wrapper).map(
		(button) =>
			[...button.element.classList]
				.find((name) => name.startsWith('rp-project-detail__entry-action--'))
				?.replace('rp-project-detail__entry-action--', '') ?? 'none',
	);

describe('the three entry paths', () => {
	it('offers the note first on a project with no plans, and names starting rather than continuing', async () => {
		const { wrapper } = rig({}, Promise.resolve(ok({ plans: [], unreadable: 0 })));
		await flushPromises();

		expect(wrapper.text()).toContain('What would you like to start with?');
		expect(wrapper.text()).toContain('You can start with a note. A floor plan is optional.');
		expect(titles(wrapper)).toEqual(['Describe your renovation', 'Start with a plan', 'Set project prices']);
		expect(ranks(wrapper)).toEqual(['primary', 'secondary', 'understated']);
		expect(actions(wrapper)[0]?.text()).toBe('Open project note');
	});

	it('creates the first plan from the start variant’s own plan entry', async () => {
		const { wrapper } = rig({}, Promise.resolve(ok({ plans: [], unreadable: 0 })));
		await flushPromises();

		const create = actions(wrapper).find((button) => button.text() === 'Create first plan');
		await create?.trigger('click');
		await flushPromises();

		expect(wrapper.findComponent(NewPlanForm).exists()).toBe(true);
	});

	it('offers the plan first on a project that has one, and asks what is next rather than what to start with', async () => {
		const { wrapper } = rig();
		await flushPromises();

		expect(wrapper.text()).toContain('What would you like to do next?');
		expect(wrapper.text()).not.toContain('A floor plan is optional');
		expect(titles(wrapper)).toEqual(['Continue with a plan', 'Describe your renovation', 'Set project prices']);
		expect(ranks(wrapper)).toEqual(['primary', 'secondary', 'understated']);
	});

	/**
	 * §6 specifies THREE ranks — primary, secondary, understated — and the first version drew two:
	 * only `at === 0` took a distinguishing class, so the second and third entries rendered
	 * identically and the ordering carried the whole meaning. The rank travels on the descriptor
	 * and is read from the DOM here, so a rank that stops reaching the element fails rather than
	 * merely looking the same.
	 */
	it('gives each entry its own priority class, three ranks rather than two', async () => {
		const { wrapper } = rig();
		await flushPromises();

		expect(new Set(ranks(wrapper)).size).toBe(3);
	});

	/**
	 * P02 forbids both by name: "Do not nest buttons inside interactive entry buttons. Decorative
	 * chevrons add no focus stop." `HostIcon` renders an `aria-hidden` `<span>`, so the glyph and
	 * the chevron are neither focusable nor announced — and the ROW is not a control either, so
	 * the entry's one labelled action is the only thing in it that can be tabbed to.
	 */
	it('adds no focus stop and no nested control for the row glyphs', async () => {
		const { wrapper } = rig();
		await flushPromises();

		const entry = wrapper.get('.rp-project-detail__entry');
		expect(entry.findAll('button')).toHaveLength(1);
		for (const icon of entry.findAll('.rp-host-icon')) {
			expect(icon.attributes('aria-hidden')).toBe('true');
			expect(icon.attributes('tabindex')).toBeUndefined();
			expect(icon.element.tagName).toBe('SPAN');
		}
	});

	/**
	 * P01, P02 and P07 all draw the visibility control BELOW the entries. It was above the
	 * region's own heading, so the first thing on the page was an offer to remove it. Asserted as
	 * document ORDER, because presence was already true when it sat in the wrong place.
	 */
	it('puts the guidance toggle below the entries', async () => {
		const { wrapper } = rig();
		await flushPromises();

		const entries = wrapper.get('.rp-project-detail__entries').element;
		const toggle = wrapper.get('.rp-project-guidance__toggle').element;
		expect(entries.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	/**
	 * A read that REFUSED or that dropped notes is not a project without plans, and the start
	 * variant would tell the user it is — inviting a first plan onto a project that may already
	 * hold several. One fact decides the variant and both of its false-empty inputs are asked
	 * here, because `plans.length === 0` alone is true in each.
	 */
	it.each([
		{ what: 'a partly unreadable read', listed: Promise.resolve(ok({ plans: [], unreadable: 2 })) },
		{ what: 'a refused read', listed: Promise.resolve(failure) },
	])('never draws the start variant on $what', async ({ listed }) => {
		const { wrapper } = rig({}, listed);
		await flushPromises();

		expect(wrapper.text()).toContain('What would you like to do next?');
		expect(wrapper.text()).not.toContain('What would you like to start with?');
	});

	it('names the stored plan and opens that one', async () => {
		const { wrapper, context } = rig({ continueContext: () => Promise.resolve({ projectId: project.id, planId: plan.id }) });
		await flushPromises();

		const open = actions(wrapper).find((button) => button.text() === 'Open Ground floor');
		expect(open).toBeDefined();
		await open?.trigger('click');
		await flushPromises();

		expect(context.openPlan).toHaveBeenCalledExactlyOnceWith(plan.id);
	});

	it.each([
		{ what: 'another project', stored: { projectId: 'other', planId: plan.id } },
		{ what: 'a plan this project does not list', stored: { projectId: project.id, planId: 'gone' } },
	])('falls back to choosing when the stored context names $what', async ({ stored }) => {
		const { wrapper } = rig({ continueContext: () => Promise.resolve(stored) });
		await flushPromises();

		expect(actions(wrapper).map((button) => button.text())).toContain('Choose a plan');
		expect(wrapper.text()).not.toContain('Open Ground floor');
	});

	it('moves focus to the first plan row rather than opening anything', async () => {
		const { wrapper, context } = rig();
		await flushPromises();

		const choose = actions(wrapper).find((button) => button.text() === 'Choose a plan');
		expect(choose?.element.disabled).toBe(false);
		await choose?.trigger('click');

		expect(document.activeElement).toBe(wrapper.get('.rp-plan-list__row').element);
		expect(context.openPlan).not.toHaveBeenCalled();
	});

	/**
	 * A failed plan read draws the active heading (a project this build cannot read is never
	 * "new") but renders no `PlanList` for "Choose a plan" to focus — `v-else-if="!plansFailure"`
	 * withholds it in favour of the retry notice. The button stays visible with its label rather
	 * than disappearing, and is disabled rather than a silent no-op.
	 */
	it('disables "Choose a plan" when a failed plan read leaves no list to focus', async () => {
		const { wrapper, context } = rig({}, Promise.resolve(failure));
		await flushPromises();

		expect(wrapper.text()).toContain('What would you like to do next?');
		const choose = actions(wrapper).find((button) => button.text() === 'Choose a plan');
		expect(choose?.element.disabled).toBe(true);
		await choose?.trigger('click');
		expect(context.openPlan).not.toHaveBeenCalled();
	});

	/**
	 * The third way a plan ROW fails to appear, and the one the two branches above do not cover:
	 * the read SUCCEEDED with every note unreadable, so there is no failure notice and the plan
	 * empty state refuses on `unreadable > 0` before it reaches the length — `PlanList` renders
	 * with zero rows. "Choose a plan" would have nothing to focus, which is the same dead button
	 * the failed-read case above already refuses.
	 */
	it('disables "Choose a plan" when every plan note is unreadable and the list draws no rows', async () => {
		const { wrapper, context } = rig({}, Promise.resolve(ok({ plans: [], unreadable: 2 })));
		await flushPromises();

		expect(wrapper.text()).toContain('What would you like to do next?');
		const choose = actions(wrapper).find((button) => button.text() === 'Choose a plan');
		expect(choose?.element.disabled).toBe(true);
		await choose?.trigger('click');
		expect(context.openPlan).not.toHaveBeenCalled();
	});

	/**
	 * Hiding guidance drops the EXPLANATIONS and keeps every action — P01's own acceptance
	 * criterion ("hiding guidance removes no core capability"), asked of the three entries and of
	 * the downstream pair beside them.
	 *
	 * **The pair moved BELOW the plan list**, out of this region, so the count here is the three
	 * entries plus the toggle and the whole-surface count is asked of `wrapper` rather than of
	 * `.rp-project-guidance`. Both are asserted, because "the region kept its own three" and "the
	 * surface kept all five" are different claims and only the second one is the criterion.
	 */
	it('keeps all five actions when guidance is hidden, and restores the explanations', async () => {
		const state = session();
		const { wrapper } = rig({ session: state });
		await flushPromises();
		const before = actions(wrapper).map((button) => button.text());
		const downstream = wrapper
			.findAll('.rp-project-detail__body > .rp-project-detail__entry-row button')
			.map((button) => button.text());
		expect(downstream).toHaveLength(2);

		await wrapper.get('.rp-project-guidance__toggle').trigger('click');

		expect(state.guidanceHidden).toBe(true);
		expect(titles(wrapper)).toEqual([]);
		expect(wrapper.findAll('.rp-project-detail__entry-body')).toHaveLength(0);
		expect(actions(wrapper).map((button) => button.text())).toEqual(before);
		expect(wrapper.findAll('.rp-project-guidance button')).toHaveLength(4);
		expect(
			wrapper.findAll('.rp-project-detail__body > .rp-project-detail__entry-row button').map((button) => button.text()),
		).toEqual(downstream);

		await wrapper.get('.rp-project-guidance__toggle').trigger('click');

		expect(state.guidanceHidden).toBe(false);
		expect(titles(wrapper)).toHaveLength(3);
	});

	/**
	 * P12: a read-only surface (mobile) may not dispatch the plan action, and the other two are
	 * not writes — dropping all three would take the note and the prices with it for no reason.
	 */
	it('disables only the plan action on a read-only surface', async () => {
		const { wrapper } = rig({ readOnly: true });
		await flushPromises();

		expect(actions(wrapper).map((button) => button.element.disabled)).toEqual([true, false, false]);
	});
});
