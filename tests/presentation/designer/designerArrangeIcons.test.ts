/**
 * @vitest-environment jsdom
 *
 * AD10's composition block, and specifically AD18-R16 Task 10: both boards draw Align and
 * Distribute as an icon row. `DesignerActionButton`'s icon-only branch moves each button's label
 * from its own text to `aria-label` — Obsidian's own tooltip source (`DesignerToolButton.vue`'s
 * convention, no `title`) — and draws the glyph the mocked `setIcon`
 * (`tests/helpers/obsidianIcons.ts`) records as `data-icon`.
 *
 * **Split out of `designerArrangePanel.test.ts`** once the final-fix-wave's new heading case
 * pushed that file over the 450-line `tests/**` cap: this describe block was already
 * self-contained — mounted bare, asserting only what the panel DRAWS, never a dispatch — so it
 * moved rather than the panel growing a second file for its write behaviour. `mountPanel` here is
 * a leaner sibling of that file's own: nothing in these cases clicks a button, so `editShape` is
 * never exercised and carries no write-tracking.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import DesignerArrangePanel from '../../../src/presentation/designer/inspector/DesignerArrangePanel.vue';
import { ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { grouped, threeBoxes } from '../../helpers/arrangeShapes';

type NullableEdit = (shape: AssetShape) => Result<AssetShape, ValidationError> | null;

const graphic = (id: string): DesignerSelection => ({ kind: 'detail', id });
const ALL = ['detail-1', 'detail-2', 'detail-3'].map((id) => graphic(id));

function mountPanel(options: { shape?: AssetShape; selected?: readonly DesignerSelection[] } = {}) {
	const editShape = vi.fn<(edit: NullableEdit) => Promise<DispatchResult>>(() => Promise.resolve(ok('no-write')));
	const wrapper = mount(DesignerArrangePanel, {
		props: {
			design: assetDesign({ shape: options.shape ?? threeBoxes() }),
			selected: options.selected ?? ALL,
			editShape,
			locked: new Set<string>(),
		},
	});
	return { wrapper };
}

describe('align and distribute draw as icon-only buttons (AD18-R16 Task 10)', () => {
	const ALIGN_CASES = [
		['align-left', 'align-horizontal-justify-start', 'designer.arrange.align.left'],
		['align-centre-x', 'align-horizontal-justify-center', 'designer.arrange.align.centre-x'],
		['align-right', 'align-horizontal-justify-end', 'designer.arrange.align.right'],
		['align-top', 'align-vertical-justify-start', 'designer.arrange.align.top'],
		['align-centre-y', 'align-vertical-justify-center', 'designer.arrange.align.centre-y'],
		['align-bottom', 'align-vertical-justify-end', 'designer.arrange.align.bottom'],
	] as const;
	const DISTRIBUTE_CASES = [
		['distribute-centres-x', 'align-horizontal-distribute-center', 'designer.arrange.distribute.centres-x'],
		['distribute-centres-y', 'align-vertical-distribute-center', 'designer.arrange.distribute.centres-y'],
		['distribute-gaps-x', 'align-horizontal-space-between', 'designer.arrange.distribute.gaps-x'],
		['distribute-gaps-y', 'align-vertical-space-between', 'designer.arrange.distribute.gaps-y'],
	] as const;

	it.each([...ALIGN_CASES, ...DISTRIBUTE_CASES])(
		"asks for %s's icon by name and keeps its old label as the accessible name",
		async (name, icon, labelKey) => {
			const { wrapper } = mountPanel();
			await flushPromises();
			const button = wrapper.get(`[name="${name}"]`);
			expect(button.find('.rp-host-icon').attributes('data-icon')).toBe(icon);
			expect(button.find('.rp-host-icon').attributes('data-icon-missing')).toBeUndefined();
			expect(button.attributes('aria-label')).toBe(t('en', labelKey));
			expect(button.text()).toBe('');
		},
	);

	it('asks for ten distinct icons across the two rows, so no two buttons read the same once the text is gone', async () => {
		const { wrapper } = mountPanel();
		await flushPromises();
		const icons = [...ALIGN_CASES, ...DISTRIBUTE_CASES].map(([name]) => wrapper.get(`[name="${name}"]`).find('.rp-host-icon').attributes('data-icon'));
		expect(icons).toHaveLength(10);
		expect(new Set(icons).size).toBe(10);
	});

	/** The group actions beside them are unchanged: still `DesignerActionButton`'s text branch, no icon and no `aria-label`. */
	it('leaves the group actions as text buttons, unaffected by the icon-only branch', async () => {
		const { wrapper } = mountPanel({ shape: grouped(['detail-1', 'detail-2']), selected: [graphic('detail-2')] });
		await flushPromises();
		const ungroup = wrapper.get('[name="ungroup"]');
		expect(ungroup.find('.rp-host-icon').exists()).toBe(false);
		expect(ungroup.attributes('aria-label')).toBeUndefined();
		expect(ungroup.text()).toBe(t('en', 'designer.arrange.ungroup'));
	});
});
