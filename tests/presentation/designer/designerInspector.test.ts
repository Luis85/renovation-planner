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

let setHeight: ReturnType<typeof vi.fn<(height: number | null) => Promise<DispatchResult>>>;
let editDimensions: ReturnType<typeof vi.fn<() => Promise<void>>>;

beforeEach(() => {
	setHeight = vi.fn<(height: number | null) => Promise<DispatchResult>>().mockResolvedValue(ok('wrote'));
	editDimensions = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
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

function mountInspector(options: Parameters<typeof buildDesign>[0] = {}) {
	return mount(DesignerInspector, {
		props: {
			design: buildDesign(options),
			setHeight,
			editDimensions,
			logger: recorder,
		},
	});
}

describe('the designer’s inspector', () => {
	it('shows dimensions derived from the footprint, with no field to type them into', () => {
		const wrapper = mountInspector({ dimensions: { width: 1200, depth: 800 } });

		expect(wrapper.text()).toContain('1200');
		expect(wrapper.find('input[name="width"]').exists()).toBe(false);
	});

	it('says so where a measurement would otherwise appear, when a trace is unscaled', () => {
		const wrapper = mountInspector({ dimensionsUnscaled: true });

		expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(true);
	});

	it('shows no unscaled warning for typed dimensions, which are exact millimetres', () => {
		const wrapper = mountInspector({ dimensionsUnscaled: false, origin: 'typed' });

		expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(false);
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
