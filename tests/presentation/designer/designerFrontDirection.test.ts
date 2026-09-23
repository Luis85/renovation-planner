/**
 * @vitest-environment jsdom
 *
 * The Front direction picker and its mini preview (AD18-R17, board 01). Every direction is checked
 * against the CANVAS's own convention — `facingTip`, the point the drawn arrow reaches, projected
 * through `worldToScreen`, the camera the designer draws with — rather than against a table of
 * angles written here. So "Top" is proven to mean "the arrow on the canvas points up the screen",
 * which is C04's rule that a direction label agree with actual placement.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DesignerReferencePlacement from '../../../src/presentation/designer/inspector/DesignerReferencePlacement.vue';
import { frontPreview } from '../../../src/presentation/designer/inspector/frontPreview';
import { presetPreview } from '../../../src/presentation/designer/presets/presetPreview';
import { facingTip } from '../../../src/presentation/designer/layers/anchorLayer';
import { DEFAULT_VIEWPORT, STAGE_PIXELS, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { footprintFromDimensions, type AssetShape } from '../../../src/domain/asset/AssetShape';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { expectOk } from '../../helpers/domain';

type NullableEdit = (shape: AssetShape) => Result<AssetShape, ValidationError> | null;

function baseShape(): AssetShape {
	const { shape } = assetDesign();
	if (shape === null) throw new Error('the fixture carries a shape');
	return shape;
}

/** `designerReferencePanels.test.ts`'s fake write chain, narrowed to what these cases read. */
function chain(shape: AssetShape, refusal?: ValidationError) {
	let live = shape;
	const writes: AssetShape[] = [];
	const editShape = vi.fn<(edit: NullableEdit) => Promise<DispatchResult>>((edit) => {
		if (refusal !== undefined) return Promise.resolve(err(refusal));
		const result = edit(live);
		if (result === null) return Promise.resolve(ok('no-write'));
		if (result.ok) {
			live = result.value;
			writes.push(result.value);
		}
		return Promise.resolve(result.ok ? ok('wrote') : err(result.error));
	});
	return { editShape, writes };
}

function mountPicker(shape: AssetShape, refusal?: ValidationError) {
	const built = chain(shape, refusal);
	const wrapper = mount(DesignerReferencePlacement, {
		props: { design: assetDesign({ shape }), editShape: built.editShape, activateAnchorTool: vi.fn<() => void>() },
	});
	return { ...built, wrapper };
}

function picker(wrapper: VueWrapper): HTMLSelectElement {
	return wrapper.find('select[name="front-direction"]').element as HTMLSelectElement;
}

async function choose(wrapper: VueWrapper, value: string): Promise<void> {
	picker(wrapper).value = value;
	await wrapper.find('select[name="front-direction"]').trigger('change');
	await flushPromises();
}

/** Where the canvas's arrow points ON SCREEN for this shape, as a unit vector. */
function canvasScreenDirection(shape: AssetShape): { x: number; y: number } {
	const from = worldToScreen(shape.anchor, DEFAULT_VIEWPORT, STAGE_PIXELS);
	const to = worldToScreen(facingTip(shape, 1), DEFAULT_VIEWPORT, STAGE_PIXELS);
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

/** Where the preview's shaft points in its own SVG space (y down, like the screen), as a unit vector. */
function previewDirection(shape: AssetShape): { x: number; y: number } {
	const [x1, y1, x2, y2] = frontPreview(shape).shaft;
	const length = Math.hypot(x2 - x1, y2 - y1);
	return { x: (x2 - x1) / length, y: (y2 - y1) / length };
}

/** What each label MEANS on the screen the user is looking at — the definition, not a derivation. */
const SCREEN: Record<string, { x: number; y: number }> = {
	up: { x: 0, y: -1 },
	right: { x: 1, y: 0 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
};

describe('the front direction picker', () => {
	it('offers the four drawing-relative directions, then Custom', () => {
		const { wrapper } = mountPicker(baseShape());
		const options = [...picker(wrapper).options];
		expect(options.map((option) => option.value)).toEqual(['up', 'right', 'down', 'left', 'custom']);
		expect(options.map((option) => option.text.trim())).toEqual([
			t('en', 'designer.placement.front.option.up'),
			t('en', 'designer.placement.front.option.right'),
			t('en', 'designer.placement.front.option.down'),
			t('en', 'designer.placement.front.option.left'),
			t('en', 'designer.placement.front.option.custom'),
		]);
	});

	it('is labelled Front direction', () => {
		const { wrapper } = mountPicker(baseShape());
		expect(wrapper.find('label').text()).toContain(t('en', 'designer.placement.front'));
		expect(wrapper.find('label').find('select[name="front-direction"]').exists()).toBe(true);
	});

	it.each([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])('selects the option the canvas arrow agrees with at facing %s', (facing) => {
		const shape: AssetShape = { ...baseShape(), facing };
		const { wrapper } = mountPicker(shape);
		expect(SCREEN[picker(wrapper).value]?.x).toBeCloseTo(canvasScreenDirection(shape).x, 9);
		expect(SCREEN[picker(wrapper).value]?.y).toBeCloseTo(canvasScreenDirection(shape).y, 9);
	});

	it('selects Custom for a front between two axes, and states no degree figure (C04)', () => {
		const { wrapper } = mountPicker({ ...baseShape(), facing: Math.PI / 4 });
		expect(picker(wrapper).value).toBe('custom');
		expect(wrapper.text()).not.toContain('°');
		expect(wrapper.text()).not.toContain('45');
	});

	/**
	 * On a traced, still-PENDING object too: a facing owns no pending flag (`SetAssetFacing`'s own
	 * docblock — an angle survives a rescale), so the picker is offered before calibration and must
	 * leave the flags it was handed exactly where they were.
	 */
	it.each(['up', 'right', 'down', 'left'])('writes a facing whose canvas arrow points %s on screen, as one edit', async (value) => {
		const shape: AssetShape = { ...baseShape(), footprintOrigin: 'traced', footprintPending: true, anchorPending: true, facing: Math.PI / 4 };
		const { wrapper, writes } = mountPicker(shape);

		await choose(wrapper, value);

		expect(writes).toHaveLength(1);
		const written = writes[0];
		if (written === undefined) throw new Error('one write');
		expect(canvasScreenDirection(written).x).toBeCloseTo(SCREEN[value]?.x ?? NaN, 9);
		expect(canvasScreenDirection(written).y).toBeCloseTo(SCREEN[value]?.y ?? NaN, 9);
		// Only the facing moved: the flags, the anchor and the outline are the ones it was handed.
		expect(written.anchor).toEqual(shape.anchor);
		expect(written.footprint).toEqual(shape.footprint);
		expect([written.footprintPending, written.anchorPending, written.clearancePending]).toEqual([true, true, false]);
	});

	it('writes nothing when the current direction is chosen again (C03, C05)', async () => {
		const { wrapper, writes, editShape } = mountPicker(baseShape());
		await choose(wrapper, 'right');
		expect(editShape).toHaveBeenCalledTimes(1);
		expect(writes).toHaveLength(0);
	});

	it('writes nothing for Custom, which names no direction to write', async () => {
		const { wrapper, writes } = mountPicker(baseShape());
		await choose(wrapper, 'custom');
		expect(writes).toHaveLength(0);
	});

	it('shows a refused write and puts the picker back on the stored direction', async () => {
		const refusal: ValidationError = { category: 'Validation', code: 'asset.invalid-facing', message: 'no' };
		const { wrapper } = mountPicker(baseShape(), refusal);

		await choose(wrapper, 'up');

		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
		expect(picker(wrapper).value).toBe('right');
	});
});

describe('the mini preview', () => {
	it('is decorative, and draws the footprint through presetPreview', () => {
		const shape = baseShape();
		const { wrapper } = mountPicker(shape);
		const svg = wrapper.find('svg.rp-designer-front-preview');
		expect(svg.attributes('aria-hidden')).toBe('true');
		expect(svg.find('.rp-designer-front-preview__footprint').attributes('d')).toBe(presetPreview(shape).footprint);
		expect(svg.find('.rp-designer-front-preview__shaft').exists()).toBe(true);
		expect(svg.find('.rp-designer-front-preview__head').exists()).toBe(true);
	});

	it.each([0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, Math.PI / 4])('points the way the canvas arrow points at facing %s', (facing) => {
		const shape: AssetShape = { ...baseShape(), facing };
		expect(previewDirection(shape).x).toBeCloseTo(canvasScreenDirection(shape).x, 9);
		expect(previewDirection(shape).y).toBeCloseTo(canvasScreenDirection(shape).y, 9);
	});

	/** A long, thin object facing across its short side: the arrow must still fit the picture. */
	it('keeps the whole arrow inside the picture for a footprint far wider than deep', () => {
		const shape: AssetShape = { ...baseShape(), footprint: expectOk(footprintFromDimensions(2000, 100)), facing: (3 * Math.PI) / 2 };
		const preview = frontPreview(shape);
		const [minX = NaN, minY = NaN, width = NaN, height = NaN] = preview.viewBox.split(' ').map(Number);
		const xs = [...preview.shaft, ...preview.head].filter((_, index) => index % 2 === 0);
		const ys = [...preview.shaft, ...preview.head].filter((_, index) => index % 2 === 1);
		for (const x of xs) expect(x).toBeGreaterThanOrEqual(minX);
		for (const x of xs) expect(x).toBeLessThanOrEqual(minX + width);
		for (const y of ys) expect(y).toBeGreaterThanOrEqual(minY);
		for (const y of ys) expect(y).toBeLessThanOrEqual(minY + height);
	});

	/** Drawn from the outline's middle rather than from the anchor, so an anchor on an edge cannot push it off the picture. */
	it('starts the arrow at the middle of the outline wherever the anchor is', () => {
		const shape: AssetShape = { ...baseShape(), anchor: { x: -600, y: 0 } };
		const [x1, y1] = frontPreview(shape).shaft;
		expect(x1).toBeCloseTo(0, 9);
		expect(y1).toBeCloseTo(0, 9);
	});
});
