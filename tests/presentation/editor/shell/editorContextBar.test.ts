// @vitest-environment jsdom
/**
 * Task 13's context bar: the breadcrumb (`Project › Floor`) and the two history actions,
 * replacing the toolbar `EditorToolbar.vue` used to carry.
 */
import { describe, expect, it } from 'vitest';
import { ok } from '../../../../src/core/result/Result';
import { t } from '../../../../src/presentation/i18n/strings';
import { fakeQueries, mountPlanEditor, mountPlanEditorCanvas, settle } from '../../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../../helpers/planFixtures';

describe('EditorContextBar', () => {
	it('names the project and the floor as a breadcrumb', async () => {
		const harness = await mountPlanEditorCanvas();
		const crumbs = harness.wrapper.findAll('.rp-context-bar__crumb').map((c) => c.text());
		expect(crumbs).toEqual(['Willow House', 'Ground floor']);
	});

	/**
	 * The bar is mounted UNCONDITIONALLY (`PlanEditorRoot.vue` renders it above the
	 * `status === 'ready'` gate the canvas waits on), so before hydration resolves both
	 * `ProjectStore.project` and `.plan` are still `null` — the one state that reaches
	 * `EditorContextBar`'s `?? ''` fallback on both sides and its `.filter` DROP arm, which the
	 * ordinary mount above never exercises (both names are always present there). A crumb
	 * rendered as an empty `<span>` would be worse than none: a screen reader announcing
	 * nothing, and a stray `›` separator with nothing on one side of it.
	 */
	it('drops a missing project or plan name from the breadcrumb, rather than rendering an empty one', async () => {
		const harness = await mountPlanEditor({
			queries: {
				...fakeQueries(null),
				// Never settles: `project` and `plan` stay `null` for the life of this case.
				getPlan: () => new Promise(() => {}),
			},
		});

		expect(harness.wrapper.findAll('.rp-context-bar__crumb')).toHaveLength(0);
	});

	it('undo and redo are disabled with an empty history and carry their names', async () => {
		const harness = await mountPlanEditorCanvas();
		const undo = harness.wrapper.find('button[data-rp-action="undo"]');
		const redo = harness.wrapper.find('button[data-rp-action="redo"]');

		expect(undo.attributes('disabled')).toBeDefined();
		expect(undo.text()).toBe(t('en', 'editor.context.undo'));
		expect(redo.attributes('disabled')).toBeDefined();
		expect(redo.text()).toBe(t('en', 'editor.context.redo'));
	});

	it('has no toolbar any more', async () => {
		const harness = await mountPlanEditorCanvas();
		expect(harness.wrapper.find('.rp-editor-toolbar').exists()).toBe(false);
		expect(harness.wrapper.find('[role="toolbar"]').exists()).toBe(false);
	});

	it('puts the plan ancestry between the project and the floor, each crumb opening its plan', async () => {
		const opened: string[] = [];
		const harness = await mountPlanEditorCanvas({
			navigation: { project: () => Promise.resolve(), library: () => undefined, plan: (id) => { opened.push(id); return Promise.resolve(); } },
			queries: {
				...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
				hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'plan-site', name: 'Site' }, { id: 'plan-house', name: 'House' }], detailPlans: [], parentZone: null, parentZoneMissing: true })),
			},
		});
		await settle();
		expect(harness.wrapper.findAll('.rp-context-bar__crumb').map((crumb) => crumb.text())).toEqual(['Willow House', 'Site', 'House', 'Ground floor']);
		await harness.wrapper.get('.rp-context-bar [data-rp-open-plan="plan-site"]').trigger('click');
		expect(opened).toEqual(['plan-site']);
		expect(harness.wrapper.text()).toContain(t('en', 'editor.input.parent-zone-missing'));
	});

	it('draws the ancestry crumbs as text when the leaf has no navigation', async () => {
		const harness = await mountPlanEditorCanvas({
			queries: {
				...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
				hierarchy: () => Promise.resolve(ok({ ancestry: [{ id: 'plan-site', name: 'Site' }], detailPlans: [], parentZone: null, parentZoneMissing: false })),
			},
		});
		await settle();

		expect(harness.wrapper.find('.rp-context-bar [data-rp-open-plan]').exists()).toBe(false);
		expect(harness.wrapper.findAll('.rp-context-bar__crumb').map((crumb) => crumb.text())).toEqual(['Willow House', 'Site', 'Ground floor']);
	});
});
