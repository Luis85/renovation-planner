/**
 * @vitest-environment jsdom
 *
 * The selection inspector's layout after AD18-R17 (board 01 panel 4): Position and Size drawn as
 * PAIRED rows, each input keeping its full sentence as its accessible name and gaining its visible
 * label, and the line style and the reorder pair folded under `Appearance` and `Order` — closed by
 * default, open state held by the `<details>` element of this leaf alone — while Duplicate and Delete
 * stay out in the open.
 *
 * What a field COMMITS is `designerSelectionInspector.test.ts`'s; this file holds where each control
 * is drawn and what it is called.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import DesignerSelectionInspector from '../../../src/presentation/designer/inspector/DesignerSelectionInspector.vue';
import { ok } from '../../../src/core/result/Result';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import type { EditShape } from '../../../src/presentation/designer/selection/editShape';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { t } from '../../../src/presentation/i18n/strings';
import { accessibleName } from '../../helpers/accessibleName';
import { assetDesign } from '../../helpers/assetDesign';
import { shapeWithRoundedRect, toiletShape } from '../../helpers/assetShapes';

const TOILET = toiletShape();

function mountFor(selection: DesignerSelection, shape: AssetShape = TOILET): VueWrapper {
	const editShape = vi.fn<EditShape>(() => Promise.resolve(ok('wrote')));
	return mount(DesignerSelectionInspector, {
		props: { design: assetDesign({ shape }), selection, editShape, select: vi.fn<(next: DesignerSelection | null) => void>() },
		attachTo: document.body,
	});
}

/**
 * Each paired row as its group's name — the text of the element its `aria-labelledby` names, which
 * `accessibleName` does not follow — and the `name`s of the inputs inside it, in order.
 */
function pairs(wrapper: VueWrapper): [string | undefined, (string | undefined)[]][] {
	return wrapper.findAll('[role="group"]').map((group) => [
		document.getElementById(group.attributes('aria-labelledby') ?? '')?.textContent ?? undefined,
		group.findAll('input').map((input) => input.attributes('name')),
	]);
}

describe('the paired rows', () => {
	it('pairs a detail’s centre under Position and its size under Size, leaving the rest one to a row', () => {
		const wrapper = mountFor({ kind: 'detail', id: 'detail-3' }, shapeWithRoundedRect());

		expect(pairs(wrapper)).toEqual([
			[t('en', 'designer.selection.fields.position'), ['centre-x', 'centre-y']],
			[t('en', 'designer.selection.fields.size'), ['width', 'depth']],
		]);
		expect(wrapper.find('[role="group"] [name="corner-radius"]').exists()).toBe(false);
		expect(wrapper.find('[role="group"] [name="rotate-by"]').exists()).toBe(false);
		wrapper.unmount();
	});

	it.each([
		['the anchor', { kind: 'anchor' }, [[t('en', 'designer.selection.fields.position'), ['position-x', 'position-y']]]],
		['the footprint', { kind: 'footprint' }, [[t('en', 'designer.selection.fields.size'), ['width', 'depth']]]],
		['the facing', { kind: 'facing' }, []],
	] as const)('pairs %s the same way', (_, selection, expected) => {
		const wrapper = mountFor(selection);

		expect(pairs(wrapper)).toEqual(expected);
		wrapper.unmount();
	});

	/**
	 * WCAG 2.5.3 over a PAIRED input: its visible label is the short one over it (`X`, `Width`), so the
	 * accessible name has to carry that, and still carries the whole sentence the field has always been
	 * named by.
	 */
	it.each([
		['detail', 'centre-x', 'designer.selection.fields.centre-x', 'horizontal centre in millimetres', 'X'],
		['detail', 'centre-y', 'designer.selection.fields.centre-y', 'vertical centre in millimetres', 'Y'],
		['detail', 'width', 'designer.preset.field.width', 'width in millimetres', 'Width'],
		['detail', 'depth', 'designer.preset.field.depth', 'depth in millimetres', 'Depth'],
		['anchor', 'position-x', 'designer.selection.fields.position-x', 'horizontal position in millimetres', 'X'],
		['anchor', 'position-y', 'designer.selection.fields.position-y', 'vertical position in millimetres', 'Y'],
	] as const)('names the %s’s %s by its visible label and its whole sentence', (kind, name, labelKey, sentence, spoken) => {
		const wrapper = mountFor(kind === 'anchor' ? { kind } : { kind, id: 'detail-2' });
		const input = wrapper.get(`[name="${name}"]`).element;

		expect(accessibleName(input)).toBe(t('en', labelKey));
		expect(accessibleName(input).toLowerCase()).toContain(sentence);
		expect(accessibleName(input).startsWith(spoken)).toBe(true);
		expect(input.closest('.rp-designer-field-row')?.querySelector('.rp-designer-field-row__label')?.textContent).toBe(spoken);
		wrapper.unmount();
	});

	/** The sentences each field was named by before it was paired, which the paired name still carries whole. */
	it.each([
		['en', 'centre-x', 'horizontal centre in millimetres'],
		['en', 'centre-y', 'vertical centre in millimetres'],
		['en', 'position-x', 'horizontal position in millimetres'],
		['en', 'position-y', 'vertical position in millimetres'],
		['de', 'centre-x', 'horizontale mitte in millimetern'],
		['de', 'centre-y', 'vertikale mitte in millimetern'],
		['de', 'position-x', 'horizontale position in millimetern'],
		['de', 'position-y', 'vertikale position in millimetern'],
	] as const)('keeps the %s %s sentence whole and led by its visible short label', (language, field, sentence) => {
		const name = t(language, `designer.selection.fields.${field}` as StringKey);
		expect(name.startsWith(t(language, `designer.selection.fields.${field}.short` as StringKey))).toBe(true);
		expect(name.toLowerCase()).toContain(sentence);
	});
});

/** The fold titled `title`, as its `<details>` element; throws when the section draws none. */
function fold(wrapper: VueWrapper, title: StringKey): HTMLDetailsElement {
	const found = wrapper.findAll('details.rp-designer-collapsible').find((details) => details.find('summary h4').text() === t('en', title));
	if (found === undefined) throw new Error(`no ${title} fold`);
	return found.element as HTMLDetailsElement;
}

describe('the Appearance and Order folds', () => {
	it('folds the line style under Appearance and the reorder pair under Order, both closed', () => {
		const wrapper = mountFor({ kind: 'detail', id: 'detail-2' });
		const appearance = fold(wrapper, 'designer.selection.fields.appearance');
		const order = fold(wrapper, 'designer.selection.fields.order');

		expect(appearance.open).toBe(false);
		expect(appearance.querySelector('select[name="detail-line"]')).not.toBeNull();
		expect(order.open).toBe(false);
		expect([...order.querySelectorAll('button')].map((button) => button.name)).toEqual(['bring-forward', 'send-backward']);
		wrapper.unmount();
	});

	it('keeps Duplicate and Delete out of every fold', () => {
		const wrapper = mountFor({ kind: 'detail', id: 'detail-2' });

		['duplicate', 'delete'].forEach((name) => expect(wrapper.get(`[name="${name}"]`).element.closest('details')).toBeNull());
		wrapper.unmount();
	});

	it('keeps the name out of every fold', () => {
		const wrapper = mountFor({ kind: 'detail', id: 'detail-2' });

		expect(wrapper.get('[name="detail-name"]').element.closest('details')).toBeNull();
		wrapper.unmount();
	});

	it.each([
		['the footprint', { kind: 'footprint' }],
		['the clearance', { kind: 'clearance' }],
		['the anchor', { kind: 'anchor' }],
		['the facing', { kind: 'facing' }],
	] as const)('draws no fold for %s, which has no line and no order', (_, selection) => {
		const wrapper = mountFor(selection);

		expect(wrapper.find('details').exists()).toBe(false);
		wrapper.unmount();
	});

	/**
	 * Leaf-local: the open state is the element's own, so a design refresh (every commit ends in one)
	 * leaves a fold the user opened open, and a fresh mount — another leaf, or this one reopened — starts
	 * closed. Nothing in a store or a setting remembers it.
	 */
	it('stays open across a design refresh, and a fresh mount starts closed', async () => {
		const wrapper = mountFor({ kind: 'detail', id: 'detail-2' });
		const appearance = () => fold(wrapper, 'designer.selection.fields.appearance');
		appearance().open = true;

		await wrapper.setProps({ design: assetDesign({ shape: toiletShape() }) });

		expect(appearance().open).toBe(true);
		const fresh = mountFor({ kind: 'detail', id: 'detail-2' });
		expect(fold(fresh, 'designer.selection.fields.appearance').open).toBe(false);
		wrapper.unmount();
		fresh.unmount();
	});

	it('titles each fold with a heading one level under the section’s own', () => {
		const wrapper = mountFor({ kind: 'detail', id: 'detail-2' });

		expect(wrapper.find('.rp-designer-selection > h3').exists()).toBe(true);
		expect(wrapper.findAll('details.rp-designer-collapsible > summary > h4.rp-designer-panel-title')).toHaveLength(2);
		wrapper.unmount();
	});
});
