// @vitest-environment jsdom
/**
 * Task 13's context bar: the breadcrumb (`Project › Floor`) and the two history actions,
 * replacing the toolbar `EditorToolbar.vue` used to carry.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { fakeQueries, mountPlanEditor, mountPlanEditorCanvas } from '../../../helpers/editor';

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
});
