/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import AssetPresetForm from '../../../src/presentation/designer/presets/AssetPresetForm.vue';
import { dimensionsOf, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { t } from '../../../src/presentation/i18n/strings';
import { expectOk } from '../../helpers/domain';
import { ASSET_PRESETS, PRESET_GROUPS } from '../../../src/domain/asset/presets/catalogue';
import { definePreset, incoherent } from '../../../src/domain/asset/presets/presetGeometry';
import { presetPreview, presetThumbnail } from '../../../src/presentation/designer/presets/presetPreview';

/**
 * One gallery choice by its catalogue id. AD07 replaced the `<select>` these cases used to drive
 * with a grid of buttons, so `setValue` on an option is no longer the gesture a user makes —
 * pressing the preset's own button is.
 */
function pick(wrapper: VueWrapper, id: string) {
	const found = wrapper.find(`.rp-preset-choice[data-preset="${id}"]`);
	if (!found.exists()) throw new Error(`the gallery draws no choice for ${id}`);
	return found;
}

describe('AssetPresetForm', () => {
	it('submits the first preset at its default values', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		expect(wrapper.find('form > svg.rp-asset-preset-preview').exists()).toBe(true);
		await wrapper.find('form').trigger('submit');

		const [[shape]] = wrapper.emitted('submit') as [[AssetShape]];
		expect(expectOk(dimensionsOf(shape.footprint))).toEqual({ width: 1600, depth: 900 });
	});

	it('resets the fields to the chosen preset’s defaults', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await pick(wrapper, 'round-table').trigger('click');

		expect((wrapper.find('input[name="diameter"]').element as HTMLInputElement).value).toBe('900');
		expect(wrapper.find('input[name="width"]').exists()).toBe(false);
	});

	it('steps a count by whole numbers and previews the chosen preset’s details', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await pick(wrapper, 'sofa').trigger('click');

		expect(wrapper.find('input[name="seats"]').attributes('step')).toBe('1');
		expect(wrapper.find('input[name="width"]').attributes('step')).toBe('any');
		expect(wrapper.find('input[name="seats"]').attributes('inputmode')).toBe('numeric');
		expect(wrapper.find('input[name="width"]').attributes('inputmode')).toBe('decimal');
		// Scoped to the LIVE preview, not to the whole form: since AD07 every gallery thumbnail
		// draws its own details too, so an unscoped count passes whatever the live preview does.
		const live = wrapper.find('form > svg.rp-asset-preset-preview');
		expect(live.findAll('.rp-asset-preset-preview__detail').length).toBeGreaterThan(0);
	});

	/**
	 * The case that USED to be here — "keeps the current preset when a change names no catalogue
	 * id" — is gone with the guard it covered. A `<select>`'s `change` carries a string that may
	 * name nothing; a gallery button carries the catalogue entry it was drawn from, so `choose`
	 * can no longer be handed an unknown id at all. An unreachable guard is not free.
	 */
	it('marks the chosen preset as the pressed one and nothing else', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await pick(wrapper, 'sofa').trigger('click');

		const pressed = wrapper
			.findAll('.rp-preset-choice')
			.filter((button) => button.attributes('aria-pressed') === 'true')
			.map((button) => button.attributes('data-preset'));
		expect(pressed).toEqual(['sofa']);
	});

	it('shows the refusal and submits nothing for a value out of range', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });
		const apply = () => wrapper.find('button[type="submit"]').attributes('aria-disabled');
		expect(apply()).toBe('false');

		await wrapper.find('input[name="width"]').setValue('0');
		await wrapper.find('form').trigger('submit');

		expect(apply()).toBe('true');
		expect(wrapper.text()).toContain(t('en', 'asset.preset-value-out-of-range'));
		expect(wrapper.emitted('submit')).toBeUndefined();
	});

	it('warns that the current design will be replaced when there is one', () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: true } });

		expect(wrapper.text()).toContain(t('en', 'designer.preset.replaces'));
	});

	/**
	 * AD07's implementation item 4. Nothing in this repository stores a preset's parameters, so
	 * what Apply writes is geometry a user edits by hand afterwards — and the form says so rather
	 * than leaving the fields to imply a live parametric object.
	 */
	it('says that a preset yields editable geometry rather than kept parameters', () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		expect(wrapper.text()).toContain(t('en', 'designer.preset.editable'));
	});
});

describe('the preset gallery AD07 put in place of the select', () => {
	it('draws every catalogue preset as a choice with a picture of its own', () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		expect(wrapper.findAll('.rp-preset-choice')).toHaveLength(ASSET_PRESETS.length);
		expect(wrapper.findAll('.rp-preset-choice svg.rp-asset-preset-preview')).toHaveLength(ASSET_PRESETS.length);
	});

	/**
	 * The groups the CATALOGUE declares, in its own order, each an announced group carrying its
	 * own name — what the `<optgroup>` gave for free and a grid of buttons has to be given.
	 */
	it('keeps the catalogue order and names each group', () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		expect(wrapper.findAll('[role="group"]').map((group) => group.attributes('aria-label'))).toEqual(
			PRESET_GROUPS.map((group) => t('en', `designer.preset.group.${group}`)),
		);
	});

	it('narrows the gallery to what the search matches, on the words a user reads', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await wrapper.find('input[name="preset-search"]').setValue('  TAB  ');

		expect(wrapper.findAll('.rp-preset-choice').map((button) => button.attributes('data-preset'))).toEqual([
			'rect-table',
			'round-table',
			'oval-table',
			'curved-table',
		]);
		// A group the search emptied is dropped rather than left as a heading over nothing.
		expect(wrapper.findAll('[role="group"]')).toHaveLength(1);
	});

	it('says so when the search matches nothing, and keeps the chosen preset’s fields', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });

		await wrapper.find('input[name="preset-search"]').setValue('zzz');

		expect(wrapper.findAll('.rp-preset-choice')).toHaveLength(0);
		expect(wrapper.text()).toContain(t('en', 'designer.preset.no-matches'));
		// The search hides choices; it does not unchoose. Apply still builds what is on screen.
		expect((wrapper.find('input[name="width"]').element as HTMLInputElement).value).toBe('1600');
	});

	/**
	 * The thumbnail's `null` arm, reached the only way it can be: a preset whose generator refuses
	 * its own defaults. `definePreset` and `incoherent` are the domain's own doors, so this is a
	 * catalogue entry somebody really could write rather than a cast.
	 */
	it('answers no thumbnail for a preset whose defaults do not build', () => {
		const broken = definePreset('chair', 'seating', [{ key: 'width', kind: 'length', min: 1, max: 2, default: 1 }], () =>
			incoherent('these values do not make a shape'),
		);

		expect(presetThumbnail(broken)).toBeNull();
	});

	it('answers a thumbnail for every preset the catalogue ships', () => {
		expect(ASSET_PRESETS.filter((preset) => presetThumbnail(preset) === null)).toEqual([]);
	});

	/**
	 * AD07's second acceptance criterion, in the half this form can actually answer for: the
	 * picture on screen is drawn from the very `AssetShape` Apply emits, so there is no second
	 * geometry to disagree with the committed one. What it does NOT reach is the library mark and
	 * plan placement — both read the STORED shape and flatten it at their own tolerances, which
	 * is a structural argument (one shape, three readers) rather than a case mounted here.
	 *
	 * The typed values are changed first, so a build that previewed the DEFAULTS while committing
	 * the typed shape — the obvious way for the two to drift — fails rather than passing on a
	 * coincidence.
	 */
	it('draws the preview from the very shape Apply commits', async () => {
		const wrapper = mount(AssetPresetForm, { props: { replaces: false } });
		await wrapper.find('input[name="width"]').setValue('1800');

		const rendered = wrapper.find('form > svg.rp-asset-preset-preview');
		await wrapper.find('form').trigger('submit');

		const [[shape]] = wrapper.emitted('submit') as [[AssetShape]];
		const expected = presetPreview(shape);
		expect(rendered.attributes('viewBox')).toBe(expected.viewBox);
		expect(rendered.find('.rp-asset-preset-preview__footprint').attributes('d')).toBe(expected.footprint);
	});
});

/**
 * AD07 review, FIX 3: the `<select>` this gallery replaced was ONE tab stop with arrow keys and
 * native type-ahead, and fourteen plain buttons are fourteen. The gallery is one tab stop again —
 * WAI-ARIA's roving tabindex, the pattern `DesignerPartsPanel.vue` already runs for the Parts list
 * and the one ruling AD08-R1 blesses that list partly for ("a single tab stop with
 * Up/Down/Home/End").
 *
 * **Both axes move ONE choice, and that is a decision rather than an omission.** The grid's column
 * count comes from `repeat(auto-fill, minmax(6rem, 1fr))` against whatever width the dialog has, so
 * nothing in this component knows it — a Left/Right that moved by a column and an Up/Down that
 * moved by a row would both have to guess, and would guess differently at every dialog width. The
 * honest model is the one dimension that IS known: the reading order the DOM is in. So Right and
 * Down are "next", Left and Up are "previous", and Home/End are the ends.
 *
 * Attached to the document because these assert `document.activeElement`, which jsdom answers
 * `body` for in a detached tree.
 */
/** Attached to the document, because these cases read `document.activeElement`. */
const mountAttached = (): VueWrapper => mount(AssetPresetForm, { props: { replaces: false }, attachTo: document.body });

/** The key pressed on the button that HAS the tab stop, so it reaches the gallery by bubbling as a real one would. */
async function press(wrapper: VueWrapper, key: string): Promise<void> {
	const tabbable = wrapper.findAll('.rp-preset-choice').find((choice) => choice.attributes('tabindex') === '0');
	if (tabbable === undefined) throw new Error('the gallery has no tab stop to press a key on');
	await tabbable.trigger('keydown', { key });
}

describe('the gallery’s keyboard', () => {
	it('gives the whole gallery one tab stop, on the chosen preset', () => {
		const wrapper = mountAttached();

		expect(wrapper.findAll('.rp-preset-choice').filter((choice) => choice.attributes('tabindex') === '0')).toHaveLength(1);
		expect(pick(wrapper, 'rect-table').attributes('tabindex')).toBe('0');
		expect(pick(wrapper, 'sofa').attributes('tabindex')).toBe('-1');
	});

	it('moves along the gallery with the arrows, and the tab stop with it', async () => {
		const wrapper = mountAttached();

		await press(wrapper, 'ArrowRight');
		expect(document.activeElement).toBe(pick(wrapper, 'round-table').element);
		expect(pick(wrapper, 'round-table').attributes('tabindex')).toBe('0');

		await press(wrapper, 'ArrowDown');
		expect(document.activeElement).toBe(pick(wrapper, 'oval-table').element);

		await press(wrapper, 'ArrowUp');
		expect(document.activeElement).toBe(pick(wrapper, 'round-table').element);
	});

	/** One list, not four: the catalogue groups are headings over the same roving tab stop. */
	it('walks out of one group and into the next', async () => {
		const wrapper = mountAttached();
		await pick(wrapper, 'curved-table').trigger('click');

		await press(wrapper, 'ArrowRight');

		expect(document.activeElement).toBe(pick(wrapper, 'chair').element);
	});

	it('clamps at both ends rather than wrapping, and ignores a key it does not take', async () => {
		const wrapper = mountAttached();

		await press(wrapper, 'ArrowLeft');
		expect(document.activeElement).toBe(pick(wrapper, 'rect-table').element);

		await press(wrapper, 'End');
		await press(wrapper, 'ArrowDown');
		expect(document.activeElement).toBe(pick(wrapper, 'bed').element);

		await press(wrapper, 'x');
		expect(document.activeElement).toBe(pick(wrapper, 'bed').element);
	});

	it('jumps to the last choice with End and back to the first with Home', async () => {
		const wrapper = mountAttached();

		await press(wrapper, 'End');
		expect(document.activeElement).toBe(pick(wrapper, 'bed').element);

		await press(wrapper, 'Home');
		expect(document.activeElement).toBe(pick(wrapper, 'rect-table').element);
	});

	/**
	 * The search can drop the choice the tab stop is on, and a gallery with no tab stop is one a
	 * keyboard cannot enter at all. It falls back — to the chosen preset if the search still draws
	 * it, else to the first choice left.
	 */
	it('keeps a tab stop when the search drops the choice that had it', async () => {
		const wrapper = mountAttached();
		await pick(wrapper, 'chair').trigger('click');
		expect(pick(wrapper, 'chair').attributes('tabindex')).toBe('0');

		await wrapper.find('input[name="preset-search"]').setValue('TAB');

		expect(wrapper.findAll('.rp-preset-choice').filter((choice) => choice.attributes('tabindex') === '0')).toHaveLength(1);
		expect(pick(wrapper, 'rect-table').attributes('tabindex')).toBe('0');
	});
});
