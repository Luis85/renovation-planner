/**
 * @vitest-environment jsdom
 *
 * AD18-R21 Task 7: the selected row's five controls (Hide/Show, Lock/Unlock, Isolate, Bring
 * forward, Send backward) draw as one row of icon-only buttons through `HostIcon`, following
 * `ZoneLockToggle.vue`'s own convention — `aria-label` carries the action (unchanged), the glyph
 * draws the CURRENT state, and `aria-pressed` is set only for the two toggles that have one.
 *
 * Mounted bare, `DesignerPartControls` directly rather than through the whole Parts panel — its
 * five props are cheap to build by hand and nothing here needs a shape, a store or a canvas.
 * `designerPartsPanel.test.ts` keeps the panel-level behaviour (what a press writes, or does not);
 * this file is the sibling that watches the five buttons' markup instead, the same split
 * `designerArrangeIcons.test.ts` drew off `designerArrangePanel.test.ts` for the identical reason.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import DesignerPartControls from '../../../../src/presentation/designer/parts/DesignerPartControls.vue';
import { createPartView } from '../../../../src/presentation/designer/parts/partView';
import { editableShape } from '../../../helpers/assetShapes';
import { t } from '../../../../src/presentation/i18n/strings';

const [TOP, BOWL] = editableShape().details;
const GRAPHIC_IDS = [TOP.id, BOWL.id];

function mountControls(options: { detail?: typeof TOP; graphicIds?: readonly string[] } = {}) {
	const view = createPartView();
	const reorder = vi.fn<(id: string, direction: 'forward' | 'backward') => void>();
	const rename = vi.fn<(id: string, label: string) => void>();
	const wrapper = mount(DesignerPartControls, {
		props: {
			detail: options.detail ?? BOWL,
			view,
			graphicIds: options.graphicIds ?? GRAPHIC_IDS,
			reorder,
			rename,
		},
	});
	return { wrapper, view, reorder, rename };
}

const button = (wrapper: ReturnType<typeof mountControls>['wrapper'], name: string) => wrapper.get(`[name="${name}"]`);
const icon = (wrapper: ReturnType<typeof mountControls>['wrapper'], name: string) => button(wrapper, name).find('.rp-host-icon');

describe('the selected row’s controls draw as icon-only buttons (AD18-R21 Task 7)', () => {
	it.each([
		['isolate', 'focus', 'designer.parts.isolate'],
		['bring-forward', 'arrow-up', 'designer.selection.bring-forward'],
		['send-backward', 'arrow-down', 'designer.selection.send-backward'],
	] as const)("asks for %s's icon by name, keeps its old label as aria-label, and draws no text", async (name, iconName, labelKey) => {
		const { wrapper } = mountControls();
		await flushPromises();

		expect(icon(wrapper, name).attributes('data-icon')).toBe(iconName);
		expect(icon(wrapper, name).attributes('data-icon-missing')).toBeUndefined();
		expect(button(wrapper, name).attributes('aria-label')).toBe(t('en', labelKey));
		expect(button(wrapper, name).text()).toBe('');
	});

	it('draws no aria-pressed on Isolate, Bring forward or Send backward — none of the three holds a state', async () => {
		const { wrapper } = mountControls();
		await flushPromises();

		for (const name of ['isolate', 'bring-forward', 'send-backward']) {
			expect(button(wrapper, name).attributes('aria-pressed')).toBeUndefined();
		}
	});

	it('draws the visible state on Hide/Show — an open eye and "Hide" while shown, aria-pressed "false"', async () => {
		const { wrapper } = mountControls();
		await flushPromises();

		expect(icon(wrapper, 'toggle-hidden').attributes('data-icon')).toBe('eye');
		expect(button(wrapper, 'toggle-hidden').attributes('aria-label')).toBe(t('en', 'designer.parts.hide'));
		expect(button(wrapper, 'toggle-hidden').attributes('aria-pressed')).toBe('false');
	});

	it('swaps to a closed eye and "Show", aria-pressed "true", once the graphic is hidden', async () => {
		const { wrapper } = mountControls();

		await button(wrapper, 'toggle-hidden').trigger('click');
		await flushPromises();

		expect(icon(wrapper, 'toggle-hidden').attributes('data-icon')).toBe('eye-off');
		expect(button(wrapper, 'toggle-hidden').attributes('aria-label')).toBe(t('en', 'designer.parts.show'));
		expect(button(wrapper, 'toggle-hidden').attributes('aria-pressed')).toBe('true');
	});

	it('draws the unlocked state on Lock/Unlock — an open padlock and "Lock", aria-pressed "false"', async () => {
		const { wrapper } = mountControls();
		await flushPromises();

		expect(icon(wrapper, 'toggle-locked').attributes('data-icon')).toBe('lock-open');
		expect(button(wrapper, 'toggle-locked').attributes('aria-label')).toBe(t('en', 'designer.parts.lock'));
		expect(button(wrapper, 'toggle-locked').attributes('aria-pressed')).toBe('false');
	});

	it('swaps to a closed padlock and "Unlock", aria-pressed "true", once the graphic is locked', async () => {
		const { wrapper } = mountControls();

		await button(wrapper, 'toggle-locked').trigger('click');
		await flushPromises();

		expect(icon(wrapper, 'toggle-locked').attributes('data-icon')).toBe('lock');
		expect(button(wrapper, 'toggle-locked').attributes('aria-label')).toBe(t('en', 'designer.parts.unlock'));
		expect(button(wrapper, 'toggle-locked').attributes('aria-pressed')).toBe('true');
	});

	it('asks for seven distinct icons across the five buttons and their two toggled states, so no two read the same', async () => {
		const { wrapper } = mountControls();
		await flushPromises();
		const before = ['toggle-hidden', 'toggle-locked', 'isolate', 'bring-forward', 'send-backward'].map((name) => icon(wrapper, name).attributes('data-icon'));

		await button(wrapper, 'toggle-hidden').trigger('click');
		await button(wrapper, 'toggle-locked').trigger('click');
		await flushPromises();
		const after = [icon(wrapper, 'toggle-hidden').attributes('data-icon'), icon(wrapper, 'toggle-locked').attributes('data-icon')];

		expect(new Set([...before, ...after]).size).toBe(7);
	});

	it('marks Bring forward disabled on the topmost graphic, aria-pressed absent throughout, and runs nothing when pressed', async () => {
		const { wrapper, reorder } = mountControls({ detail: BOWL, graphicIds: GRAPHIC_IDS });

		expect(button(wrapper, 'bring-forward').attributes('aria-disabled')).toBe('true');
		expect(button(wrapper, 'bring-forward').attributes('disabled')).toBeUndefined();
		expect(button(wrapper, 'send-backward').attributes('aria-disabled')).toBeUndefined();

		await button(wrapper, 'bring-forward').trigger('click');

		expect(reorder).not.toHaveBeenCalled();
	});

	it('marks Send backward disabled on the bottom graphic and runs nothing when pressed', async () => {
		const { wrapper, reorder } = mountControls({ detail: TOP, graphicIds: GRAPHIC_IDS });

		expect(button(wrapper, 'send-backward').attributes('aria-disabled')).toBe('true');
		expect(button(wrapper, 'send-backward').attributes('disabled')).toBeUndefined();
		expect(button(wrapper, 'bring-forward').attributes('aria-disabled')).toBeUndefined();

		await button(wrapper, 'send-backward').trigger('click');

		expect(reorder).not.toHaveBeenCalled();
	});
});
