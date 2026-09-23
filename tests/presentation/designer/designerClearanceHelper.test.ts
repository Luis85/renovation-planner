/**
 * @vitest-environment jsdom
 *
 * The Clearance section's AD18-R17 controls (board 01): the `Show clearance` switch, the uniform
 * `All sides` field, and the four per-side fields folded under `Advanced`. What the four fields
 * GENERATE is `designerReferencePanels.test.ts`'s, which still drives them one by one.
 *
 * The switch is driven through `designerRig`, the REAL wiring: it binds the leaf runtime's
 * `showClearance`, and what it hides is a Konva layer on the canvas, read as the layer's own
 * `visible` attribute rather than as pixels (jsdom paints nothing a test could read back).
 * Everything else mounts the helper bare, which is also the case proving a mount with no leaf
 * runtime draws no switch rather than throwing.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DesignerClearanceHelper from '../../../src/presentation/designer/inspector/DesignerClearanceHelper.vue';
import { ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { rect } from '../../../src/domain/asset/presets/presetGeometry';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { editableShape } from '../../helpers/assetShapes';
import { click, designerRig, selecting, type DesignerRig } from '../../helpers/designerRig';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import type { Point } from '../../../src/core/geometry/Point';
import { settle } from '../../helpers/editor';

type NullableEdit = (shape: AssetShape) => Result<AssetShape, ValidationError> | null;

const SIDES = ['front', 'back', 'left', 'right'] as const;

function baseShape(): AssetShape {
	const { shape } = assetDesign();
	if (shape === null) throw new Error('the fixture carries a shape');
	return shape;
}

function mountHelper(shape: AssetShape = baseShape()) {
	const writes: AssetShape[] = [];
	const editShape = vi.fn<(edit: NullableEdit) => Promise<DispatchResult>>((edit) => {
		const result = edit(shape);
		if (result !== null && result.ok) writes.push(result.value);
		return Promise.resolve(ok('wrote'));
	});
	return { writes, wrapper: mount(DesignerClearanceHelper, { props: { design: assetDesign({ shape }), editShape } }) };
}

const valueOf = (wrapper: VueWrapper, name: string): string => (wrapper.get(`[name="${name}"]`).element as HTMLInputElement).value;

async function type(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	const field = wrapper.get(`[name="${name}"]`);
	(field.element as HTMLInputElement).value = value;
	await field.trigger('input');
}

describe('the All sides field', () => {
	it('fills all four sides with the one number typed into it', async () => {
		const { wrapper } = mountHelper();
		await type(wrapper, 'clearance-all-sides', '300');
		expect(SIDES.map((side) => valueOf(wrapper, `clearance-${side}`))).toEqual(['300', '300', '300', '300']);
		expect(valueOf(wrapper, 'clearance-all-sides')).toBe('300');
	});

	it('goes blank once one side is edited away from the others, and leaves the other three alone', async () => {
		const { wrapper } = mountHelper();
		await type(wrapper, 'clearance-all-sides', '300');
		await type(wrapper, 'clearance-front', '600');
		expect(valueOf(wrapper, 'clearance-all-sides')).toBe('');
		expect(SIDES.map((side) => valueOf(wrapper, `clearance-${side}`))).toEqual(['600', '300', '300', '300']);
	});

	it('generates exactly what four equal side fields would, through the same Generate press', async () => {
		const viaAll = mountHelper();
		await type(viaAll.wrapper, 'clearance-all-sides', '300');
		await viaAll.wrapper.get('[name="generate-clearance"]').trigger('click');
		await flushPromises();

		const viaSides = mountHelper();
		for (const side of SIDES) await type(viaSides.wrapper, `clearance-${side}`, '300');
		await viaSides.wrapper.get('[name="generate-clearance"]').trigger('click');
		await flushPromises();

		expect(viaAll.writes).toHaveLength(1);
		expect(viaAll.writes[0].clearance).toEqual(viaSides.writes[0].clearance);
	});

	it('writes nothing until Generate is pressed', async () => {
		const { wrapper, writes } = mountHelper();
		await type(wrapper, 'clearance-all-sides', '300');
		expect(writes).toHaveLength(0);
	});

	it('draws as a compact row whose short label sits inside its accessible name, with an mm suffix', () => {
		const { wrapper } = mountHelper();
		const row = wrapper.get('[name="clearance-all-sides"]').element.closest('.rp-designer-field-row');
		expect(row?.querySelector('.rp-designer-field-row__label')?.textContent).toBe(t('en', 'designer.clearance.all-sides.short'));
		expect(row?.querySelector('.rp-designer-field-row__unit')?.textContent).toBe('mm');
		expect(wrapper.get('[name="clearance-all-sides"]').attributes('aria-label')).toBe(t('en', 'designer.clearance.all-sides'));
	});
});

describe('nothing is pre-filled (§4 row 7, AD14-R1)', () => {
	it('starts all five fields empty, even beside a clearance that stands a uniform 300 off every side', () => {
		// A 1200 x 800 footprint inside 1800 x 1400: the one case a read-back WOULD have a figure for.
		const { wrapper } = mountHelper({ ...baseShape(), clearance: rect(1800, 1400) });
		for (const name of ['all-sides', ...SIDES]) expect(valueOf(wrapper, `clearance-${name}`)).toBe('');
	});
});

describe('the Advanced fold', () => {
	it('holds the four side fields, closed by default, with All sides and Generate outside it', () => {
		const { wrapper } = mountHelper();
		const fold = wrapper.get('details.rp-designer-collapsible');
		expect((fold.element as HTMLDetailsElement).open).toBe(false);
		expect(fold.get('summary').text()).toBe(t('en', 'designer.clearance.advanced'));
		for (const side of SIDES) expect(fold.find(`[name="clearance-${side}"]`).exists()).toBe(true);
		expect(fold.find('[name="clearance-all-sides"]').exists()).toBe(false);
		expect(fold.find('[name="generate-clearance"]').exists()).toBe(false);
	});
});

describe('the Show clearance switch', () => {
	it('draws no switch on a mount with no leaf runtime, rather than throwing', () => {
		const { wrapper } = mountHelper({ ...baseShape(), clearance: rect(1800, 1400) });
		expect(wrapper.find('[name="show-clearance"]').exists()).toBe(false);
	});

	it('is on by default, and hides and shows the canvas clearance layer', async () => {
		const rig = await designerRig({ shape: editableShape(), camera: 'default' });
		try {
			const toggle = rig.wrapper.get('[name="show-clearance"]');
			const input = toggle.element as HTMLInputElement;
			const layer = () => rig.stage.findOne('.asset-clearance');
			expect(input.checked).toBe(true);
			expect(toggle.attributes('role')).toBe('switch');
			expect(input.closest('label')?.textContent?.trim()).toBe(t('en', 'designer.clearance.show'));
			expect(layer()?.visible()).toBe(true);

			await toggle.setValue(false);
			await settle();
			expect(layer()?.visible()).toBe(false);

			await toggle.setValue(true);
			await settle();
			expect(layer()?.visible()).toBe(true);
		} finally {
			rig.unmount();
		}
	});

	it('is not drawn for a design with no clearance to show', async () => {
		const rig = await designerRig({ shape: editableShape({ clearance: null }), camera: 'default' });
		try {
			expect(rig.wrapper.find('[name="show-clearance"]').exists()).toBe(false);
		} finally {
			rig.unmount();
		}
	});
});

// Inside `editableShape()`'s clearance, outside its 1000 x 600 footprint and every detail.
const BAND: Point = { x: 600, y: 0 };

async function hiding(): Promise<DesignerRig> {
	const rig = await selecting(editableShape());
	await rig.wrapper.get('[name="show-clearance"]').setValue(false);
	await settle();
	return rig;
}

const selection = (rig: DesignerRig) => useAssetDesignStore(rig.pinia).selection;
const legendKinds = (rig: DesignerRig) => rig.wrapper.findAll('.rp-designer-legend__swatch').map((swatch) => swatch.classes().find((name) => name.startsWith('rp-designer-legend__swatch--')));

/**
 * AD18-R17 review: "off" means off everywhere on the canvas, not just in the pixels. A press on the
 * empty-looking band falls through exactly as a Parts-hidden graphic's does (`hitDesign` owns that
 * rule), and the legend stops explaining a boundary it is not drawing. The Parts row stays the
 * deliberate way in.
 */
describe('with Show clearance off', () => {
	it('selects the clearance from its band while it is drawn', async () => {
		const rig = await selecting(editableShape());
		try {
			click(rig, BAND);
			await settle();
			expect(selection(rig)).toEqual({ kind: 'clearance' });
		} finally {
			rig.unmount();
		}
	});

	it('lets a press on the band fall through to nothing, so the hidden clearance cannot be selected or deleted by it', async () => {
		const rig = await hiding();
		try {
			click(rig, BAND);
			await settle();
			expect(selection(rig)).toBeNull();
		} finally {
			rig.unmount();
		}
	});

	it('drops the legend’s Clearance row, and puts it back when switched on', async () => {
		const rig = await hiding();
		try {
			expect(legendKinds(rig)).not.toContain('rp-designer-legend__swatch--clearance');
			expect(legendKinds(rig)).toContain('rp-designer-legend__swatch--footprint');

			await rig.wrapper.get('[name="show-clearance"]').setValue(true);
			await settle();
			expect(legendKinds(rig)).toContain('rp-designer-legend__swatch--clearance');
		} finally {
			rig.unmount();
		}
	});

	it('switches back on when Generate writes a new boundary, so it is never born invisible', async () => {
		const rig = await hiding();
		try {
			const field = rig.wrapper.get('[name="clearance-all-sides"]');
			(field.element as HTMLInputElement).value = '250';
			await field.trigger('input');
			await rig.wrapper.get('[name="generate-clearance"]').trigger('click');
			await settle();

			expect((rig.wrapper.get('[name="show-clearance"]').element as HTMLInputElement).checked).toBe(true);
			expect(rig.stage.findOne('.asset-clearance')?.visible()).toBe(true);
		} finally {
			rig.unmount();
		}
	});

	it('still selects it from its Parts row, which draws the selection outline over the hidden layer', async () => {
		const rig = await hiding();
		try {
			(rig.wrapper.element.querySelector('.rp-designer-part-row[name="clearance"]') as HTMLButtonElement).click();
			await settle();
			expect(selection(rig)).toEqual({ kind: 'clearance' });
			expect(rig.stage.findOne('.asset-clearance')?.visible()).toBe(false);
			expect(rig.stage.findOne('.asset-selection-outline')).toBeDefined();
		} finally {
			rig.unmount();
		}
	});
});
