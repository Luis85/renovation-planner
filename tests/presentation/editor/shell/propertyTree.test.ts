// @vitest-environment jsdom
/**
 * The Property tree (M01, sidebar polish 2026-09-10): the project row, then every plan of
 * the project as a sibling floor, the current one marked `aria-current`. Navigation goes
 * through the ONE `navigation.plan` door; without one the rows are text.
 */
import { describe, expect, it, vi } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import { tr } from '../../../../src/presentation/i18n/strings';
import type { PlanDto } from '../../../../src/presentation/read-models/PlanDto';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_PROJECT } from '../../../helpers/planFixtures';
import { mountPlanEditorCanvas } from '../../../helpers/editor';

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
});
