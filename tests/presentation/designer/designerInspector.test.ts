/**
 * @vitest-environment jsdom
 *
 * Task B8's inspector, in isolation: derived dimensions, an honest unscaled warning, and the
 * one editable scalar it owns — height. No Pinia and no dialog host: `DesignerInspector` reaches
 * neither directly, taking `setHeight` and `editDimensions` as PROPS instead, the same shape
 * `RequirementRow` and `NewAssetForm` already take for a write and a hand-off respectively —
 * which is what lets this file mount the component bare and assert on the callback rather than
 * on a mounted dialog framework. `assetDimensions.test.ts` is where `editDimensions` itself
 * (built in `AssetDesignerRoot.vue`, opening the real `asset-dimensions` dialog and dispatching
 * the real command) is driven end to end — this file's own case below asserts only that the
 * button reaches the prop it is handed, not what that prop does once it is called.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import DesignerInspector from '../../../src/presentation/designer/inspector/DesignerInspector.vue';
import { err, ok } from '../../../src/core/result/Result';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { recorder } from '../../helpers/logger';
import { assetDesign } from '../../helpers/assetDesign';
import { t } from '../../../src/presentation/i18n/strings';
import type { DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { ref, type Ref } from 'vue';
import { editableShape } from '../../helpers/assetShapes';

let setHeight: ReturnType<typeof vi.fn<(height: number | null) => Promise<DispatchResult>>>;
let editDimensions: ReturnType<typeof vi.fn<() => Promise<void>>>;
let startFromPreset: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
	setHeight = vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote'));
	editDimensions = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
	startFromPreset = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
});

/**
 * Every option overrides one thing the tests below vary. `dimensions: undefined` (the default)
 * leaves the fixture's own 1200×800 pair; passing `dimensions: null` is how a case would ask
 * for the shapeless state, though none below needs it — `assetDesignerRoot.test.ts` and
 * `assetDimensions.test.ts` are where that state's OWN surface (the empty state, not this
 * panel) is driven.
 */
function buildDesign(options: {
	readonly dimensions?: { readonly width: number; readonly depth: number } | null;
	readonly dimensionsUnscaled?: boolean;
	readonly origin?: 'typed' | 'traced';
	readonly height?: number | null;
	/** A shape with two graphics, which is what makes composing a set possible at all (AD08). */
	readonly manyGraphics?: boolean;
} = {}): AssetDesignDto {
	const base = assetDesign();
	if (options.manyGraphics === true) return { ...base, shape: editableShape() };
	return {
		...base,
		...(options.height !== undefined ? { height: options.height } : {}),
		dimensions: options.dimensions !== undefined ? options.dimensions : base.dimensions,
		dimensionsUnscaled: options.dimensionsUnscaled ?? base.dimensionsUnscaled,
		shape:
			base.shape === null
				? null
				: { ...base.shape, footprintOrigin: options.origin ?? base.shape.footprintOrigin },
	};
}

function mountInspector(
	options: Parameters<typeof buildDesign>[0] = {},
	selection: DesignerSelection | null = null,
	extras: { openLibrary?: () => void; selected?: readonly DesignerSelection[]; mode?: Ref<boolean> } = {},
) {
	return mount(DesignerInspector, {
		props: {
			...(extras.openLibrary === undefined ? {} : { openLibrary: extras.openLibrary }),
			// A value down and a setter up, which is how the component takes it: `v-model` on a prop
			// is a mutation of one, and `vue/no-mutating-props` refuses it.
			...(extras.mode === undefined
				? {}
				: {
						multiSelectionMode: extras.mode.value,
						setMultiSelectionMode: (next: boolean): void => {
							if (extras.mode !== undefined) extras.mode.value = next;
						},
					}),
			// Defaults to the primary alone, which is what a single-part selection IS (AD08).
			selected: extras.selected ?? (selection === null ? [] : [selection]),
			// Required rather than defaulted, deliberately: this file mounts the inspector for
			// reasons that have nothing to do with locks, and an empty set is the honest answer
			// for a leaf with none — but it has to be SAID, so a mount that meant to bind real
			// locks cannot forget to. The component's own docblock carries why.
			lockedGraphics: new Set<string>(),
			design: buildDesign(options),
			setHeight,
			editDimensions,
			startFromPreset,
			logger: recorder,
			// Required, and never pressed by these cases: `designerReferenceView.test.ts` drives the gesture.
			removeBackground: async (): Promise<void> => {},
			selection,
			// Never called by these cases: `designerSelectionInspector.test.ts` owns what a selection commits.
			editShape: vi.fn<() => Promise<DispatchResult>>().mockResolvedValue(ok('no-write')),
			select: vi.fn<(next: DesignerSelection | null) => void>(),
		},
	});
}

describe('the designer’s inspector', () => {
	it('shows dimensions derived from the footprint, with no field to type them into', () => {
		const wrapper = mountInspector({ dimensions: { width: 1200, depth: 800 } });

		expect(wrapper.text()).toContain('1200');
		expect(wrapper.find('input[name="width"]').exists()).toBe(false);
	});

	/** A curve's box is irrational: a curved table measures 2121.3203435596424 wide. */
	it('shows dimensions in whole millimetres, never the float a curve measures to', () => {
		const wrapper = mountInspector({ dimensions: { width: 2121.3203435596424, depth: 863.6038969321073 } });

		expect(wrapper.find('.rp-designer-inspector-fields dd').text()).toBe('2121 × 864 mm');
	});

	it('says so where a measurement would otherwise appear, when a trace is unscaled', () => {
		const wrapper = mountInspector({ dimensionsUnscaled: true });

		expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(true);
	});

	it('shows no unscaled warning for typed dimensions, which are exact millimetres', () => {
		const wrapper = mountInspector({ dimensionsUnscaled: false, origin: 'typed' });

		expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(false);
	});

	it('draws a section for the selected part only while something is selected', () => {
		expect(mountInspector().find('.rp-designer-selection').exists()).toBe(false);
		expect(mountInspector({}, { kind: 'footprint' }).find('.rp-designer-selection').exists()).toBe(true);
	});

	/**
	 * Critique finding 4: under a selected detail's section, the asset's "Dimensions 380 × 700 mm" read as
	 * that detail's size. The asset's own block now opens with its own heading, after the part's section.
	 */
	/**
	 * NARROWED at AD12, from an assertion that the asset's heading was the ONLY one to one that it is
	 * the FIRST — which is what this case's own name and its finding are about. The exhaustive form
	 * was an enumeration of the inspector's siblings rather than of its subject, so the three blocks
	 * AD12 added below the asset's block turned it red while the ordering it exists to hold was
	 * untouched. The slice is what a section OPENS, so `[0]` and `slice(0, 2)` are the whole claim.
	 */
	it('heads the asset’s own block, after the selected part’s section when there is one', () => {
		const headings = (selection: DesignerSelection | null) => mountInspector({}, selection).findAll('h3').map((heading) => heading.text());

		expect(headings(null)[0]).toBe(t('en', 'designer.inspector.asset'));
		expect(headings({ kind: 'footprint' }).slice(0, 2)).toEqual([t('en', 'designer.selection.footprint'), t('en', 'designer.inspector.asset')]);
	});

	it('draws no dimensions block at all for a shapeless asset', () => {
		const wrapper = mountInspector({ dimensions: null });

		expect(wrapper.find('.rp-designer-inspector-fields').exists()).toBe(false);
	});

	/**
	 * **The control that CREATES a shape may not be hidden until there is one**, and the
	 * assertion above used to require exactly that — the defect encoded as a test, which this
	 * repository has now recorded twice.
	 *
	 * It was reachable in ONE state and unreachable in the state that needs it. A shapeless
	 * asset with no sheet selects `noBackground`, whose only action is the picker, and
	 * `selectAssetDesignerEmptyState` ranks it above `noShape` deliberately — so the whole of
	 * "type a width and a depth", which needs no sheet and no calibration at all, sat behind
	 * choosing an unrelated file first. The ordering is left alone, because it is a considered
	 * decision with its own cases; what changes is that the inspector, which is mounted in
	 * every state, always offers the gesture.
	 *
	 * The LABEL differs because the gesture does: with no shape there is nothing to edit.
	 */
	it('offers the dimensions editor for a shapeless asset, which is how one gets a shape', async () => {
		const wrapper = mountInspector({ dimensions: null });

		expect(wrapper.find('.rp-designer-edit-dimensions').text()).toBe(t('en', 'designer.inspector.set-dimensions'));
		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');

		expect(editDimensions).toHaveBeenCalledTimes(1);
	});

	it('offers the same editor from the inspector once a shape exists', async () => {
		const wrapper = mountInspector({ dimensions: { width: 1200, depth: 800 } });

		expect(wrapper.find('.rp-designer-edit-dimensions').text()).toBe(t('en', 'designer.inspector.edit-dimensions'));
		await wrapper.find('.rp-designer-edit-dimensions').trigger('click');

		expect(editDimensions).toHaveBeenCalledTimes(1);
	});

	it('offers a preset as a way to start or replace a design', async () => {
		const wrapper = mountInspector();

		expect(wrapper.find('.rp-designer-start-preset').text()).toBe(t('en', 'designer.inspector.start-preset'));
		await wrapper.find('.rp-designer-start-preset').trigger('click');

		expect(startFromPreset).toHaveBeenCalledTimes(1);
	});

	it('commits a height on blur and keeps the typed value when the command refuses', async () => {
		setHeight.mockResolvedValue(err({ category: 'Validation', code: 'asset.negative-height', message: 'x' }));
		const input = mountInspector({ height: 900 }).find('input[name="height"]');

		await input.setValue('-10');
		await input.trigger('blur');
		await flushPromises();

		expect(setHeight).toHaveBeenCalledTimes(1);
		expect((input.element as HTMLInputElement).value).toBe('-10');
	});

	/**
	 * The Reset-button lesson from slice 16, met here at a field with no reset button to walk
	 * past the guard: `useFieldCommit`'s own `submitted === null` check is what closes it. A
	 * dispatch for a change nobody made would buy a vault write and an undo entry.
	 */
	it('does not dispatch when a clean height field is blurred', async () => {
		await mountInspector({ height: 900 }).find('input[name="height"]').trigger('blur');

		expect(setHeight).not.toHaveBeenCalled();
	});

	it('commits a height on blur and clears the field once the command succeeds', async () => {
		const input = mountInspector({ height: 900 }).find('input[name="height"]');

		await input.setValue('1200');
		await input.trigger('blur');
		await flushPromises();

		expect(setHeight).toHaveBeenCalledWith(1200);
	});

	it('commits null when the height field is cleared, which asks to say nothing about it', async () => {
		const input = mountInspector({ height: 900 }).find('input[name="height"]');

		await input.setValue('');
		await input.trigger('blur');
		await flushPromises();

		expect(setHeight).toHaveBeenCalledWith(null);
	});

	it('commits on Enter as well as on blur', async () => {
		const input = mountInspector({ height: 900 }).find('input[name="height"]');

		await input.setValue('1300');
		await input.trigger('keydown.enter');
		await flushPromises();

		expect(setHeight).toHaveBeenCalledWith(1300);
	});

	it('discards the draft on Escape, dispatching nothing', async () => {
		const input = mountInspector({ height: 900 }).find('input[name="height"]');

		await input.setValue('1300');
		await input.trigger('keydown', { key: 'Escape' });
		await flushPromises();

		expect(setHeight).not.toHaveBeenCalled();
		expect((input.element as HTMLInputElement).value).toBe('900');
	});
});


/**
 * AD06: the panel says WHICH object this is, and offers the way back to the catalogue.
 *
 * The name matters because nothing else on the surface carries it — `getDisplayText` titles every
 * designer leaf "Asset designer" whatever asset it holds, which is the Plan Editor's convention and
 * not this view's to change alone, and a per-asset view is the one you can have three of at once.
 */
describe('identifying the object and getting back to the library', () => {
	it('names the asset it is designing', () => {
		expect(mountInspector().find('.rp-designer-asset-name').text()).toBe('Base cabinet 600');
	});

	it('offers the library door, and calls it', async () => {
		const openLibrary = vi.fn<() => void>();
		const wrapper = mountInspector({}, null, { openLibrary });
		await wrapper.find('.rp-designer-open-library').trigger('click');
		expect(openLibrary).toHaveBeenCalledTimes(1);
	});

	/** Slice 14's Amendment 1: no door bound, no control — never a live one that does nothing. */
	it('draws no library control where no door is bound', () => {
		expect(mountInspector().find('.rp-designer-open-library').exists()).toBe(false);
	});
});

/**
 * AD08 / C05: the panel says how many parts are selected, and carries the control that lets a
 * keyboard or a touch user build the set — a modifier alone is not a route.
 */
describe('a selection of several parts', () => {
	const two: readonly DesignerSelection[] = [{ kind: 'detail', id: 'detail-1' }, { kind: 'detail', id: 'detail-2' }];

	it('counts them', () => {
		const wrapper = mountInspector({}, two[1], { selected: two });
		expect(wrapper.find('.rp-designer-selection-count').text()).toBe(t('en', 'designer.selection.count', { count: '2' }));
	});

	/** One selected part is already named by its own section; a count of "1" would say it twice. */
	it('counts nothing for a single part, or for none', () => {
		expect(mountInspector({}, { kind: 'detail', id: 'detail-1' }).find('.rp-designer-selection-count').exists()).toBe(false);
		expect(mountInspector().find('.rp-designer-selection-count').exists()).toBe(false);
	});

	it('offers the select-multiple control where the design has more than one graphic', () => {
		const wrapper = mountInspector({ manyGraphics: true }, null, { mode: ref(false) });
		expect(wrapper.find('[data-rp-action="multiple-selection"]').exists()).toBe(true);
	});

	it('turns the mode on through the control, so a canvas press extends rather than replaces', async () => {
		const mode = ref(false);
		const wrapper = mountInspector({ manyGraphics: true }, null, { mode });
		await wrapper.find('[data-rp-action="multiple-selection"]').setValue(true);
		expect(mode.value).toBe(true);
	});

	/** Slice 14's Amendment 1 again: no runtime bound, no control. */
	it('draws no control where no mode is bound', () => {
		expect(mountInspector({ manyGraphics: true }).find('[data-rp-action="multiple-selection"]').exists()).toBe(false);
	});

	/** Nor where there is nothing to compose: one graphic cannot be part of a set of two. */
	it('draws no control for a design with one graphic, until the mode is already on', () => {
		expect(mountInspector({}, null, { mode: ref(false) }).find('[data-rp-action="multiple-selection"]').exists()).toBe(false);
		expect(mountInspector({}, null, { mode: ref(true) }).find('[data-rp-action="multiple-selection"]').exists()).toBe(true);
	});
});
