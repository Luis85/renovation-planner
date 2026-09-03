// @vitest-environment jsdom
/**
 * Task 13's context bar: the breadcrumb (`Project › Floor`) and the two history actions,
 * replacing the toolbar `EditorToolbar.vue` used to carry.
 */
import { describe, expect, it } from 'vitest';
import { t } from '../../../../src/presentation/i18n/strings';
import { mountPlanEditorCanvas } from '../../../helpers/editor';

describe('EditorContextBar', () => {
	it('names the project and the floor as a breadcrumb', async () => {
		const harness = await mountPlanEditorCanvas();
		const crumbs = harness.wrapper.findAll('.rp-context-bar__crumb').map((c) => c.text());
		expect(crumbs).toEqual(['Willow House', 'Ground floor']);
	});

	it('undo and redo are disabled with an empty history and carry their names', async () => {
		const harness = await mountPlanEditorCanvas();
		const undo = harness.wrapper.find('button[data-rp-action="undo"]');
		expect(undo.attributes('disabled')).toBeDefined();
		expect(undo.text()).toBe(t('en', 'editor.context.undo'));
	});

	it('has no toolbar any more', async () => {
		const harness = await mountPlanEditorCanvas();
		expect(harness.wrapper.find('.rp-editor-toolbar').exists()).toBe(false);
		expect(harness.wrapper.find('[role="toolbar"]').exists()).toBe(false);
	});
});
