// @vitest-environment jsdom
/**
 * The Property tree (M01, sidebar polish 2026-09-10): the project row, then every plan of
 * the project as a sibling floor, the current one marked `aria-current`. Navigation goes
 * through the ONE `navigation.plan` door; without one the rows are text.
 */
import { describe, expect, it, vi } from 'vitest';
import { err, ok } from '../../../../src/core/result/Result';
import { t, tr } from '../../../../src/presentation/i18n/strings';
import type { PlanDto } from '../../../../src/presentation/read-models/PlanDto';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_PROJECT } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas, settle } from '../../../helpers/editor';

const FIRST: PlanDto = { ...FIXTURE_PLAN, id: 'plan-first', name: 'First floor' };
const queries = () => ({ ...fakeQueries(FIXTURE_PLAN), listPlans: () => Promise.resolve(ok([FIXTURE_PLAN, FIRST])) });

describe('PropertyTree', () => {
	it('lists the project, then each plan as a floor with the open one current', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries() });
		const tree = harness.wrapper.get('.rp-property-tree');

		expect(tree.get('.rp-property-tree__project').text()).toContain('Willow House');
		const floors = tree.findAll('.rp-property-tree__floor');
		expect(floors.map((f) => f.text())).toEqual(['Ground floor', 'First floor']);
		expect(floors[0].attributes('aria-current')).toBe('page');
		expect(floors[1].attributes('aria-current')).toBeUndefined();
	});

	it('opens a sibling floor through navigation.plan', async () => {
		const plan = vi.fn<(planId: string) => Promise<void>>(() => Promise.resolve());
		const harness = await mountPlanEditorCanvas({
			queries: queries(),
			navigation: { project: () => Promise.resolve(), library: () => {}, plan },
		});

		await harness.wrapper.findAll('.rp-property-tree__floor')[1].trigger('click');

		expect(plan).toHaveBeenCalledWith('plan-first');
	});

	it('draws the floors as text when the leaf has no navigation', async () => {
		const harness = await mountPlanEditorCanvas({ queries: queries() });

		expect(harness.wrapper.findAll('button.rp-property-tree__floor')).toHaveLength(0);
		expect(harness.wrapper.findAll('.rp-property-tree__floor')).toHaveLength(2);
	});

	it('opens the project through navigation.project', async () => {
		const project = vi.fn<(projectId: string) => Promise<void>>(() => Promise.resolve());
		const harness = await mountPlanEditorCanvas({
			queries: queries(),
			navigation: { project, library: () => {}, plan: () => Promise.resolve() },
		});

		await harness.wrapper.get('.rp-property-tree__project').trigger('click');

		expect(project).toHaveBeenCalledWith(FIXTURE_PROJECT.id);
	});

	it('falls back to the floor label for an unnamed plan', async () => {
		const unnamed: PlanDto = { ...FIXTURE_PLAN, id: 'plan-unnamed', name: '' };
		const harness = await mountPlanEditorCanvas({
			queries: { ...fakeQueries(FIXTURE_PLAN), listPlans: () => Promise.resolve(ok([FIXTURE_PLAN, unnamed])) },
		});

		const floors = harness.wrapper.get('.rp-property-tree').findAll('.rp-property-tree__floor');
		expect(floors[1].text()).toContain(tr('editor.floor'));
	});

	/**
	 * Since the PropertyTreeRow refactor, an unnamed sibling floor drawn as a BUTTON (navigation
	 * present, not the current plan) renders the same fallback label — findings round 1, item 3:
	 * the button branch had no assertion of its own, so the behaviour was accidental rather than
	 * deliberate.
	 */
	it('falls back to the floor label for an unnamed plan drawn as a button', async () => {
		const unnamed: PlanDto = { ...FIXTURE_PLAN, id: 'plan-unnamed', name: '' };
		const harness = await mountPlanEditorCanvas({
			navigation: { project: () => Promise.resolve(), library: () => undefined, plan: () => Promise.resolve() },
			queries: { ...fakeQueries(FIXTURE_PLAN), listPlans: () => Promise.resolve(ok([FIXTURE_PLAN, unnamed])) },
		});

		// FIXTURE_PLAN is the current floor and stays text (disabled); only the unnamed sibling
		// is a button, so it is the sole element here rather than index 1 as in the text case above.
		const floors = harness.wrapper.get('.rp-property-tree').findAll('button.rp-property-tree__floor');
		expect(floors).toHaveLength(1);
		expect(floors[0].text()).toContain(tr('editor.floor'));
	});

	/**
	 * Findings round 1, item 2: the only prior ancestry assertion
	 * (`editorContextBar.test.ts`) checks `.rp-context-bar`, which `PropertyTree`'s own ancestry
	 * rows never draw into — this file had none.
	 */
	it('puts the plan ancestry between the project row and the floors, each row opening its plan', async () => {
		const opened: string[] = [];
		const harness = await mountPlanEditorCanvas({
			navigation: { project: () => Promise.resolve(), library: () => undefined, plan: (id) => { opened.push(id); return Promise.resolve(); } },
			queries: {
				...fakeQueries(FIXTURE_PLAN),
				hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'plan-site', name: 'Site' }, { id: 'plan-house', name: 'House' }], detailPlans: [], parentZone: null, parentZoneMissing: false })),
			},
		});
		await settle();

		const tree = harness.wrapper.get('.rp-property-tree');
		const rows = tree.findAll('[data-rp-open-plan]');
		expect(rows.map((row) => row.text())).toEqual(['Site', 'House']);
		expect(rows.every((row) => row.element.tagName === 'BUTTON')).toBe(true);

		await tree.get('[data-rp-open-plan="plan-site"]').trigger('click');
		expect(opened).toEqual(['plan-site']);
	});

	it('draws the ancestry rows as text when the leaf has no navigation', async () => {
		const harness = await mountPlanEditorCanvas({
			queries: {
				...fakeQueries(FIXTURE_PLAN),
				hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'plan-site', name: 'Site' }], detailPlans: [], parentZone: null, parentZoneMissing: false })),
			},
		});
		await settle();

		const tree = harness.wrapper.get('.rp-property-tree');
		expect(tree.find('[data-rp-open-plan]').exists()).toBe(false);
		expect(tree.text()).toContain('Site');
	});

	/**
	 * Findings round 2, item 2: `floors` was `ProjectStore.plans`, every plan of the project —
	 * a detail plan's tree then repeated its ancestors (already drawn as ancestry rows) and
	 * listed every other branch's plans as if they were floors of this one. Floors are now
	 * filtered to this plan's own siblings (same parent).
	 */
	it('lists only this plan\'s own siblings as floors, not every plan of the project', async () => {
		const HOUSE_PARENT = { planId: 'plan-house', zoneId: 'zone-house' };
		const SITE_PARENT = { planId: 'plan-site', zoneId: 'zone-site' };
		const site: PlanDto = { ...FIXTURE_PLAN, id: 'plan-site', name: 'Site' };
		const house: PlanDto = { ...FIXTURE_PLAN, id: 'plan-house', name: 'House', parent: SITE_PARENT };
		const attic: PlanDto = { ...FIXTURE_PLAN, id: 'plan-attic', name: 'Attic', parent: HOUSE_PARENT };
		const ground: PlanDto = { ...FIXTURE_PLAN, id: 'plan-ground', name: 'Ground floor', parent: HOUSE_PARENT };
		const harness = await mountPlanEditorCanvas({
			navigation: { project: () => Promise.resolve(), library: () => undefined, plan: () => Promise.resolve() },
			queries: {
				...fakeQueries(ground),
				listPlans: () => Promise.resolve(ok([site, house, attic, ground])),
				hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: site.id, name: site.name }, { id: house.id, name: house.name }], detailPlans: [], parentZone: null, parentZoneMissing: false })),
			},
		});
		await settle();

		const tree = harness.wrapper.get('.rp-property-tree');
		// The floors list only: `.rp-property-tree__floor` also matches ancestry rows, since both
		// share `PropertyTreeRow`'s markup, so scoping to the `<ul>` is what keeps this assertion
		// from also counting the ancestry rows it is meant to prove ABSENT here.
		const floors = tree.get('.rp-property-tree__floors').findAll('.rp-property-tree__floor');
		expect(floors.map((f) => f.text())).toEqual(['Attic', 'Ground floor']);

		const ancestryNames = tree.findAll('[data-rp-open-plan]').map((row) => row.text());
		expect(ancestryNames).toEqual(['Site', 'House']);
		expect(floors.map((f) => f.text())).not.toContain('Site');
		expect(floors.map((f) => f.text())).not.toContain('House');
	});

	it('lists only the root plans as floors for a root plan', async () => {
		const SITE_PARENT = { planId: 'plan-site', zoneId: 'zone-site' };
		const site: PlanDto = { ...FIXTURE_PLAN, id: 'plan-site', name: 'Site' };
		const otherRoot: PlanDto = { ...FIXTURE_PLAN, id: 'plan-garden', name: 'Garden' };
		const house: PlanDto = { ...FIXTURE_PLAN, id: 'plan-house', name: 'House', parent: SITE_PARENT };
		const harness = await mountPlanEditorCanvas({
			queries: {
				...fakeQueries(site),
				listPlans: () => Promise.resolve(ok([site, otherRoot, house])),
			},
		});
		await settle();

		const floors = harness.wrapper.get('.rp-property-tree').findAll('.rp-property-tree__floor');
		expect(floors.map((f) => f.text())).toEqual(['Site', 'Garden']);
	});

	/** Closes the deferred Task 4 minor: the tree draws project row, then ancestry, then floors. */
	it('draws the project row, then ancestry rows, then the floors list, in that order', async () => {
		const SITE_PARENT = { planId: 'plan-site', zoneId: 'zone-site' };
		const site: PlanDto = { ...FIXTURE_PLAN, id: 'plan-site', name: 'Site' };
		const ground: PlanDto = { ...FIXTURE_PLAN, id: 'plan-ground', name: 'Ground floor', parent: SITE_PARENT };
		const harness = await mountPlanEditorCanvas({
			navigation: { project: () => Promise.resolve(), library: () => undefined, plan: () => Promise.resolve() },
			queries: {
				...fakeQueries(ground),
				listPlans: () => Promise.resolve(ok([site, ground])),
				hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: site.id, name: site.name }], detailPlans: [], parentZone: null, parentZoneMissing: false })),
			},
		});
		await settle();

		// Direct children of `.rp-property-tree` are drawn in template order: the project row,
		// then one row per ancestor, then the floors list — reading `tree.children` pins that
		// order without reaching for `compareDocumentPosition`.
		const children = [...harness.wrapper.get('.rp-property-tree').element.children];
		const projectIndex = children.findIndex((el) => el.className.includes('rp-property-tree__project'));
		const ancestryIndex = children.findIndex((el) => el.hasAttribute('data-rp-open-plan'));
		const floorsIndex = children.findIndex((el) => el.className.includes('rp-property-tree__floors'));
		expect(projectIndex).toBeGreaterThanOrEqual(0);
		expect(ancestryIndex).toBeGreaterThan(projectIndex);
		expect(floorsIndex).toBeGreaterThan(ancestryIndex);
	});

	it('shows the missing-parent line when the hierarchy reports one, and nothing when it does not', async () => {
		const missing = await mountPlanEditorCanvas({
			queries: {
				...fakeQueries(FIXTURE_PLAN),
				hierarchy: () => Promise.resolve(ok({ ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: true })),
			},
		});
		await settle();
		expect(missing.wrapper.get('.rp-property-tree').text()).toContain(t('en', 'editor.input.parent-zone-missing'));

		const present = await mountPlanEditorCanvas({
			queries: {
				...fakeQueries(FIXTURE_PLAN),
				hierarchy: () => Promise.resolve(ok({ ancestry: [], detailPlans: [], parentZone: null, parentZoneMissing: false })),
			},
		});
		await settle();
		expect(present.wrapper.get('.rp-property-tree').text()).not.toContain(t('en', 'editor.input.parent-zone-missing'));
	});

	it('says the hierarchy could not be read rather than drawing a parentless plan', async () => {
		const harness = await mountPlanEditorCanvas({
			queries: { ...fakeQueries(FIXTURE_PLAN), hierarchy: () => Promise.resolve(err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'io' } as const)) },
		});
		await settle();
		expect(harness.wrapper.get('.rp-property-tree').text()).toContain(t('en', 'editor.input.hierarchy-unreadable'));
	});
});
