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

let setHeight: ReturnType<typeof vi.fn<(height: number | null) => Promise<DispatchResult>>>;
let editDimensions: ReturnType<typeof vi.fn<() => Promise<void>>>;
let activateAnchorTool: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
	setHeight = vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote'));
	editDimensions = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
	activateAnchorTool = vi.fn<() => void>();
});

/**
 * Every option overrides one thing the tests below vary. `dimensions: undefined` (the default)
 * leaves the fixture's own 1200×800 pair; passing `dimensions: null` is how a case asks for
 * the shapeless state, which *draws no dimensions block at all for a shapeless asset* and
 * *offers the dimensions editor for a shapeless asset* below both do —
 * `grep -n "dimensions: null"` prints three lines here and two of them are those calls, the
 * third being this sentence. It read "though none below needs it", which was already false at
 * `d672c3c8a`, the commit that wrote it: one of those two calls was in that same commit and the
 * other arrived at `8ea7a0551`. `assetDesignerRoot.test.ts` and `assetDimensions.test.ts` stay
 * named for what they actually own, which is unchanged — that state's OTHER surface, the empty
 * state rather than this panel.
 */
function buildDesign(options: {
	readonly dimensions?: { readonly width: number; readonly depth: number } | null;
	readonly dimensionsUnscaled?: boolean;
	readonly origin?: 'typed' | 'traced';
	readonly height?: number | null;
} = {}): AssetDesignDto {
	const base = assetDesign();
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
	extras: { selected?: readonly DesignerSelection[] } = {},
) {
	return mount(DesignerInspector, {
		props: {
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
			activateAnchorTool,
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

	/**
	 * AD18-R16 Task 7: board 01 groups Width, Depth and Height as one fact block, so Height now
	 * sits directly after the W × D row rather than after `Edit dimensions` — the control that
	 * REWRITES the block, drawn once the facts in it are stated rather than in the middle of them.
	 */
	it('places Height directly with Dimensions, before Edit dimensions', () => {
		const wrapper = mountInspector({ dimensions: { width: 1200, depth: 800 }, height: 900 });
		const dimensions = wrapper.get('.rp-designer-inspector-fields');
		const height = wrapper.get('input[name="height"]');
		const editButton = wrapper.get('.rp-designer-edit-dimensions');

		expect(Boolean(dimensions.element.compareDocumentPosition(height.element) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
		expect(Boolean(height.element.compareDocumentPosition(editButton.element) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
	});

	/**
	 * **AD18-R6: the preset door LEFT this panel**, and this case is the ruling written to a check
	 * rather than the old one deleted. That ruling refuses two STANDING controls answering one
	 * question — the rail owns the way into a preset and the Inspector drops its copy — and a
	 * second door re-added here would be exactly as green as no door at all if nothing asked.
	 *
	 * Where the door went and that it still works is `designerAddRail.test.ts`'s subject; this file
	 * can only speak for the panel it mounts, which is why the sentence is an absence and not a
	 * claim about the surface as a whole.
	 */
	it('draws no preset door of its own, which AD18-R6 moved into the Add rail', () => {
		const wrapper = mountInspector();

		expect(wrapper.find('.rp-designer-start-preset').exists()).toBe(false);
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

	/**
	 * AD18-R16 Task 5's follow-up: Height draws the same compact-row PRESENTATION
	 * `DesignerFieldRow` draws, without becoming that component — it keeps `FieldError`'s
	 * draft/commit/cancel/pending contract, unaffected by every case above this one.
	 */
	it('draws the height field as a compact row: a short label, the full sentence as the accessible name, and an mm suffix', () => {
		const input = mountInspector({ height: 900 }).find('input[name="height"]');
		const row = (input.element as HTMLInputElement).closest('.rp-designer-field-row') as HTMLElement;

		expect(row.querySelector('.rp-designer-field-row__label')?.textContent).toBe(t('en', 'designer.inspector.height.short'));
		expect(input.attributes('aria-label')).toBe(t('en', 'designer.inspector.height'));
		expect(row.querySelector('.rp-designer-field-row__unit')?.textContent).toBe('mm');
	});

	/** `FieldError`'s own message stays a sibling AFTER the row, exactly where it drew before this task. */
	it('keeps the height error text under the row rather than inside it', async () => {
		setHeight.mockResolvedValue(err({ category: 'Validation', code: 'asset.negative-height', message: 'x' }));
		const wrapper = mountInspector({ height: 900 });
		const input = wrapper.find('input[name="height"]');

		await input.setValue('-10');
		await input.trigger('blur');
		await flushPromises();

		const errorField = wrapper.get('.rp-field-error');
		const row = errorField.get('.rp-designer-field-row');
		const message = errorField.get('.rp-field-error__message');
		const position = row.element.compareDocumentPosition(message.element);

		expect(Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
	});
});


/*
 * **The three cases that used to sit here — the asset's name, the library door and the unbound-door
 * refusal — MOVED to `designerHeader.test.ts` in AD18**, because ruling AD18-R1 moved both controls
 * into the header. They were moved rather than copied: a case left behind asserting this panel
 * still draws them would be the second answer to "which asset is this" that the ruling exists to
 * prevent, and that file now counts the name over the whole mounted tree rather than in one region.
 */

/**
 * AD08 / C05: the panel says how many parts are selected. The control that let a keyboard or
 * touch user build the set MOVED to `DesignerPartsPanel` at AD18-R16 Task 7 —
 * `designerPartsPanel.test.ts`'s own "select multiple parts" describe block is where its cases
 * live now, unmoved apart from mounting the other component.
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
});
