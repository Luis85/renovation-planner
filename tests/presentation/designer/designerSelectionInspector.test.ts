/**
 * @vitest-environment jsdom
 *
 * The inspector for the selection (asset designer symbols spec, Presentation; Amendment 1).
 *
 * Mounted BARE with a fake `editShape` that applies the edit it is handed to the fixture, so every
 * case asserts the shape the control would write rather than which function it happened to name.
 * The last case mounts the real designer, because a component proven bare and bound to nothing is
 * the slice-7 shape this repository refuses.
 *
 * The fixture is the Toilet preset at its defaults: a 380 × 700 round-fronted footprint, detail-1
 * the tank, detail-2 the bowl (a stadium whose curve-aware box is 304 × 450 centred on (0, 100),
 * corner points (±152, 27) and (±152, 173), bulges [1, 0, 1, 0]), anchor at the origin, facing π/2.
 */
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import DesignerSelectionInspector from '../../../src/presentation/designer/inspector/DesignerSelectionInspector.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { ValidationError } from '../../../src/core/errors/AppError';
import type { Point } from '../../../src/core/geometry/Point';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { validateAssetShape, type AssetShape } from '../../../src/domain/asset/AssetShape';
import {
	deleteDetail,
	fitFootprintToDetails,
	reorderDetail,
	updateDetail,
} from '../../../src/domain/asset/detailEdits';
import { moveAnchor, removeClearance, setFacing } from '../../../src/domain/asset/shapeEdits';
import { sameSelection, type DesignerSelection } from '../../../src/presentation/designer/selection/designerSelection';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
import { openGraphic, shapeWithOpenGraphic, shapeWithRoundedRect, toiletShape } from '../../helpers/assetShapes';
import { expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { designerRig } from '../../helpers/designerRig';

type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;

const TOILET = toiletShape();

const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };

/** A line with no depth at all: `shapeWithOpenGraphic`'s third graphic replaced by a flat run. */
function flatLine(): AssetShape {
	const base = shapeWithOpenGraphic();
	return expectOk(validateAssetShape({
		...base,
		details: [...base.details.filter((detail) => detail.id !== 'detail-3'), openGraphic('detail-3', [{ x: -300, y: 0 }, { x: 300, y: 0 }])],
	}));
}

/**
 * `advances`: the fake's LIVE shape takes each edit that lands while the props stay on the first read —
 * `createEditShape`'s serialised chain between a write and the refresh that follows it.
 */
function mountFor(selection: DesignerSelection, shape: AssetShape | null = TOILET, answer?: DispatchResult, advances = false) {
	const applied: Result<AssetShape, ValidationError>[] = [];
	// Only read for a mounted section, which exists only over a shape.
	let live = shape as AssetShape;
	const editShape = vi.fn<(edit: ShapeEdit) => Promise<DispatchResult>>((edit) => {
		const result = edit(live);
		applied.push(result);
		if (advances && result.ok) live = result.value;
		return Promise.resolve(answer ?? (result.ok ? ok('wrote') : err(result.error)));
	});
	const select = vi.fn<(next: DesignerSelection | null) => void>();
	const wrapper = mount(DesignerSelectionInspector, {
		props: { design: assetDesign({ shape }), selection, editShape, select },
	});
	return { wrapper, editShape, select, applied };
}

/** One `change`, WITHOUT waiting for the commit it starts to settle. */
async function changeNow(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	const control = wrapper.find(`[name="${name}"]`);
	(control.element as HTMLInputElement | HTMLSelectElement).value = value;
	await control.trigger('change');
}

async function change(wrapper: VueWrapper, name: string, value: string): Promise<void> {
	await changeNow(wrapper, name, value);
	await flushPromises();
}

function numberFields(wrapper: VueWrapper): Record<string, string> {
	return Object.fromEntries(
		wrapper.findAll('input[type="number"]').map((input) => [input.attributes('name'), (input.element as HTMLInputElement).value]),
	);
}

function buttons(wrapper: VueWrapper): (string | undefined)[] {
	return wrapper.findAll('button').map((button) => button.attributes('name'));
}

/** An action button's `aria-disabled` and `disabled`, together: an unavailable reorder sets the first, never the second. */
function actionState(wrapper: VueWrapper, name: string): [string | undefined, boolean] {
	const button = wrapper.find(`[name="${name}"]`);
	return [button.attributes('aria-disabled'), (button.element as HTMLButtonElement).disabled];
}

function nameField(wrapper: VueWrapper): string {
	return (wrapper.find('[name="detail-name"]').element as HTMLInputElement).value;
}

function outlineOfDetail(result: Result<AssetShape, ValidationError> | undefined, id: string) {
	if (result === undefined) throw new Error('no edit was applied');
	const found = expectOk(result).details.find((detail) => detail.id === id);
	if (found === undefined) throw new Error(`no detail ${id} in the applied shape`);
	return found.outline;
}

function expectNear(points: readonly Point[], expected: readonly (readonly [number, number])[]): void {
	expect(points).toHaveLength(expected.length);
	points.forEach((point, index) => {
		expect(point.x).toBeCloseTo(expected[index][0], 6);
		expect(point.y).toBeCloseTo(expected[index][1], 6);
	});
}

describe('what the inspector offers for each kind of part', () => {
	it('draws a detail’s name, line, centre, size and rotation, with its four actions', () => {
		const { wrapper } = mountFor(BOWL);

		expect(wrapper.find('h3').text()).toBe(t('en', 'designer.selection.detail'));
		expect(nameField(wrapper)).toBe(t('en', 'designer.detail.bowl'));
		expect((wrapper.find('[name="detail-line"]').element as HTMLSelectElement).value).toBe('solid');
		expect(numberFields(wrapper)).toEqual({ 'centre-x': '0', 'centre-y': '100', width: '304', depth: '450', 'rotate-by': '0' });
		expect(buttons(wrapper)).toEqual(['bring-forward', 'send-backward', 'duplicate', 'delete']);
	});

	/** Spec Decision 8: a detail's name is a stable key, shown through its label where one exists. */
	it('shows a name with no label exactly as it is stored', () => {
		const renamed = { ...TOILET, details: TOILET.details.map((detail) => (detail.id === 'detail-2' ? { ...detail, name: 'lid' } : detail)) };

		expect(nameField(mountFor(BOWL, renamed).wrapper)).toBe('lid');
	});

	it('draws the footprint’s size and Fit to details, and nothing a detail has', () => {
		const { wrapper } = mountFor({ kind: 'footprint' });

		expect(wrapper.find('h3').text()).toBe(t('en', 'designer.selection.footprint'));
		expect(numberFields(wrapper)).toEqual({ width: '380', depth: '700' });
		expect(buttons(wrapper)).toEqual(['fit-to-details']);
		expect(wrapper.find('[name="detail-name"]').exists()).toBe(false);
	});

	it('offers no Fit to details on a design that has no details', () => {
		const { wrapper } = mountFor({ kind: 'footprint' }, { ...TOILET, details: [] });

		expect(buttons(wrapper)).toEqual([]);
	});

	/** A pending footprint's numbers are placeholder pixels, which Width and Depth would label millimetres. */
	it('offers no Width or Depth for a footprint whose numbers are not measurements yet', () => {
		const mountWith = (dimensionsUnscaled: boolean) =>
			mount(DesignerSelectionInspector, {
				props: { design: assetDesign({ shape: TOILET, dimensionsUnscaled }), selection: { kind: 'footprint' }, editShape: vi.fn<(edit: ShapeEdit) => Promise<DispatchResult>>(), select: vi.fn<(next: DesignerSelection | null) => void>() },
			});

		expect(numberFields(mountWith(true))).toEqual({});
		expect(numberFields(mountWith(false))).toEqual({ width: '380', depth: '700' });
	});

	it('draws only Delete for the clearance', () => {
		const { wrapper } = mountFor({ kind: 'clearance' });

		expect(numberFields(wrapper)).toEqual({});
		expect(buttons(wrapper)).toEqual(['delete']);
	});

	it('draws the anchor’s position and the facing’s angle in whole degrees', () => {
		expect(numberFields(mountFor({ kind: 'anchor' }).wrapper)).toEqual({ 'position-x': '0', 'position-y': '0' });
		expect(numberFields(mountFor({ kind: 'facing' }).wrapper)).toEqual({ angle: '90' });
	});

	/**
	 * AD18-R16 Task 5 review (Important finding): branch coverage cannot see a transposed
	 * short-label key or a dropped `unit` literal — `centre-x.short`/`centre-y.short` swapped,
	 * or `width`'s `mm` missing, would ship silently. This pins every field's short visible
	 * label, its unit suffix and its full accessible name BY NAME, in
	 * `designerReferencePanels.test.ts`'s own table-driven shape (the clearance helper).
	 */
	it('pins every field’s short label, unit suffix and full accessible name', () => {
		const detail = mountFor(BOWL).wrapper;
		const anchor = mountFor({ kind: 'anchor' }).wrapper;
		const facing = mountFor({ kind: 'facing' }).wrapper;
		const rounded = mountFor({ kind: 'detail', id: 'detail-3' }, shapeWithRoundedRect()).wrapper;

		([
			[detail, 'width', 'designer.preset.field.width.short', 'designer.preset.field.width', 'mm'],
			[detail, 'depth', 'designer.preset.field.depth.short', 'designer.preset.field.depth', 'mm'],
			[detail, 'centre-x', 'designer.selection.centre-x.short', 'designer.selection.centre-x', 'mm'],
			[detail, 'centre-y', 'designer.selection.centre-y.short', 'designer.selection.centre-y', 'mm'],
			[detail, 'rotate-by', 'designer.selection.rotate-by.short', 'designer.selection.rotate-by', '°'],
			[rounded, 'corner-radius', 'designer.selection.corner-radius.short', 'designer.selection.corner-radius', 'mm'],
			[anchor, 'position-x', 'designer.selection.position-x.short', 'designer.selection.position-x', 'mm'],
			[anchor, 'position-y', 'designer.selection.position-y.short', 'designer.selection.position-y', 'mm'],
			[facing, 'angle', 'designer.selection.angle.short', 'designer.selection.angle', '°'],
		] as const).forEach(([wrapper, name, shortKey, labelKey, unit]) => {
			const input = wrapper.get(`[name="${name}"]`).element as HTMLInputElement;
			const row = input.closest('.rp-designer-field-row') as HTMLElement;
			expect(row.querySelector('.rp-designer-field-row__label')?.textContent).toBe(t('en', shortKey));
			expect(input.getAttribute('aria-label')).toBe(t('en', labelKey));
			expect(row.querySelector('.rp-designer-field-row__unit')?.textContent).toBe(unit);
		});
	});

	/** PBI extension 2a: no control for a part the asset does not carry. */
	it('draws nothing for a part the shape lacks', () => {
		expect(mountFor({ kind: 'detail', id: 'detail-9' }).wrapper.find('.rp-designer-selection').exists()).toBe(false);
		expect(mountFor({ kind: 'clearance' }, { ...TOILET, clearance: null }).wrapper.find('.rp-designer-selection').exists()).toBe(false);
		expect(mountFor({ kind: 'footprint' }, null).wrapper.find('.rp-designer-selection').exists()).toBe(false);
	});

	/** The section draws nothing for a part the shape lacks, so its unmount has no element to ask about focus. */
	it('unmounts a section drawn for a part the shape lacks without reaching for focus', () => {
		const { wrapper } = mountFor({ kind: 'detail', id: 'detail-9' });

		expect(() => wrapper.unmount()).not.toThrow();
	});

	/**
	 * Critique finding 25: "Angle in degrees" did not say which way 0 points or which way the angle grows.
	 * `facingTip` adds the sine to y and y grows DOWN the screen, so 0 points right and 90 points down; the
	 * field names that sentence as its description. No other field carries one.
	 */
	it('describes the facing’s angle by where 0 and 90 point, and no other field', () => {
		const facing = mountFor({ kind: 'facing' }).wrapper;
		const describedBy = facing.find('[name="angle"]').attributes('aria-describedby');

		expect(describedBy).toBeDefined();
		expect(facing.find(`[id="${String(describedBy)}"]`).text()).toBe(t('en', 'designer.selection.angle.hint'));
		expect(mountFor(BOWL).wrapper.findAll('input[aria-describedby]')).toHaveLength(0);
	});

	/**
	 * A pending detail's or anchor's numbers are placeholder pixels too, which calibration later multiplies
	 * (spec Amendment 2) — so its millimetre fields are withheld as a pending footprint's are, one line says
	 * why, and everything that is not a length stays.
	 */
	it('offers only Rotation for a pending detail, keeps its name, line and actions, and says why', () => {
		const pendingBowl = { ...TOILET, details: TOILET.details.map((detail) => (detail.id === 'detail-2' ? { ...detail, pending: true } : detail)) };
		const { wrapper } = mountFor(BOWL, pendingBowl);

		expect(numberFields(wrapper)).toEqual({ 'rotate-by': '0' });
		expect(buttons(wrapper)).toEqual(['bring-forward', 'send-backward', 'duplicate', 'delete']);
		expect(nameField(wrapper)).toBe(t('en', 'designer.detail.bowl'));
		expect(wrapper.find('[name="detail-line"]').exists()).toBe(true);
		expect(wrapper.find('.rp-designer-unscaled').text()).toBe(t('en', 'designer.selection.unscaled'));
	});

	it('offers no position for a pending anchor, and says why', () => {
		const { wrapper } = mountFor({ kind: 'anchor' }, { ...TOILET, anchorPending: true });

		expect(numberFields(wrapper)).toEqual({});
		expect(wrapper.find('.rp-designer-unscaled').text()).toBe(t('en', 'designer.selection.unscaled'));
	});

	/** Every arm that is NOT pending: the flag read is the SELECTED part's, never a neighbour's. */
	it.each([
		['a detail', BOWL, TOILET],
		['a detail beside a pending one', BOWL, { ...TOILET, details: TOILET.details.map((detail) => (detail.id === 'detail-1' ? { ...detail, pending: true } : detail)) }],
		['the anchor', { kind: 'anchor' }, TOILET],
		['the facing of a design whose anchor is pending', { kind: 'facing' }, { ...TOILET, anchorPending: true }],
	] as const)('keeps every field and draws no unscaled line for %s', (_name, selection, shape) => {
		const { wrapper } = mountFor(selection, shape);

		expect(Object.keys(numberFields(wrapper)).length).toBeGreaterThan(selection.kind === 'detail' ? 1 : 0);
		expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(false);
	});

	/** The footprint arm is unchanged: its warning is `DesignerInspector`'s Dimensions block, not a second line here. */
	it('leaves the pending footprint as it was: no size fields and no unscaled line in the section', () => {
		const wrapper = mount(DesignerSelectionInspector, {
			props: {
				design: assetDesign({ shape: { ...TOILET, footprintOrigin: 'traced', footprintPending: true }, dimensionsUnscaled: true }),
				selection: { kind: 'footprint' },
				editShape: vi.fn<(edit: ShapeEdit) => Promise<DispatchResult>>(),
				select: vi.fn<(next: DesignerSelection | null) => void>(),
			},
		});

		expect(numberFields(wrapper)).toEqual({});
		expect(buttons(wrapper)).toEqual(['fit-to-details']);
		expect(wrapper.find('.rp-designer-unscaled').exists()).toBe(false);
	});
});

describe('what a field commits', () => {
	/**
	 * Depth lands the typed CURVE-AWARE extent (carry.md, Task 9): the bowl's ends bow 152 beyond its
	 * corner points, so its points span 900 − 304 = 596 about y = 100. Width is linear here — its sides
	 * are straight — so it lands as a plain doubling.
	 */
	it.each([
		['centre-x', '50', [[-102, 27], [202, 27], [202, 173], [-102, 173]]],
		['centre-y', '150', [[-152, 77], [152, 77], [152, 223], [-152, 223]]],
		['width', '608', [[-304, 27], [304, 27], [304, 173], [-304, 173]]],
		['depth', '900', [[-152, -198], [152, -198], [152, 398], [-152, 398]]],
	] as const)('commits %s = %s as ONE edit about the bowl’s box, keeping its rounded ends', async (name, value, expected) => {
		const { wrapper, editShape, applied } = mountFor(BOWL);

		await change(wrapper, name, value);

		expect(editShape).toHaveBeenCalledTimes(1);
		const outline = outlineOfDetail(applied[0], 'detail-2');
		expectNear(outline.points, expected);
		expect(outline.bulges).toEqual([1, 0, 1, 0]);
	});

	it('rotates by the degrees typed about the box centre, then resets the field to 0', async () => {
		const { wrapper, applied } = mountFor(BOWL);

		await change(wrapper, 'rotate-by', '90');

		expectNear(outlineOfDetail(applied[0], 'detail-2').points, [[73, -52], [73, 252], [-73, 252], [-73, -52]]);
		expect((wrapper.find('[name="rotate-by"]').element as HTMLInputElement).value).toBe('0');
	});

	it.each([
		['position-x', '50', moveAnchor(TOILET, { x: 50, y: 0 })],
		['position-y', '-20', moveAnchor(TOILET, { x: 0, y: -20 })],
	] as const)('moves the anchor through %s', async (name, value, expected) => {
		const { wrapper, applied } = mountFor({ kind: 'anchor' });

		await change(wrapper, name, value);

		expect(applied).toEqual([expected]);
	});

	it('sets the facing from degrees', async () => {
		const { wrapper, applied } = mountFor({ kind: 'facing' });

		await change(wrapper, 'angle', '180');

		expect(applied).toEqual([setFacing(TOILET, Math.PI)]);
	});

	it('renames a detail and changes its line through updateDetail', async () => {
		const { wrapper, applied } = mountFor(BOWL);

		await change(wrapper, 'detail-name', 'seat');
		await change(wrapper, 'detail-line', 'dashed');

		expect(applied).toEqual([
			updateDetail(TOILET, 'detail-2', { name: 'seat' }),
			updateDetail(TOILET, 'detail-2', { line: 'dashed' }),
		]);
	});

	it('commits nothing for a field emptied and left', async () => {
		const { wrapper, editShape } = mountFor(BOWL);

		await change(wrapper, 'width', '');

		expect(editShape).not.toHaveBeenCalled();
	});

	it('shows a refusal in one alert, and clears it with the next commit that lands', async () => {
		const { wrapper } = mountFor(BOWL);

		await change(wrapper, 'width', '0');
		expect(wrapper.findAll('[role="alert"]')).toHaveLength(1);
		expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.invalid-scale'));

		await change(wrapper, 'width', '608');
		expect(wrapper.find('[role="alert"]').exists()).toBe(false);
	});
});

/** The middle of an outline's corner points — the bowl's box centre too, since the stadium is symmetric about it. */
function midpoint(points: readonly Point[]): Point {
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/**
 * Two commits inside one refresh window (findings r1, Important 1): the second edit is handed the shape
 * the first wrote while the rendered props still show the first read, so it must build on what it is
 * handed rather than on a value captured at render.
 */
describe('fields committed before the refresh lands', () => {
	it('keeps a typed position x when position y is typed before the refresh', async () => {
		const { wrapper, applied } = mountFor({ kind: 'anchor' }, TOILET, undefined, true);

		await changeNow(wrapper, 'position-x', '50');
		await changeNow(wrapper, 'position-y', '-20');
		await flushPromises();

		expect(expectOk(applied[1]).anchor).toEqual({ x: 50, y: -20 });
	});

	it('moves the centre TO a second typed x, not by it again', async () => {
		const { wrapper, applied } = mountFor(BOWL, TOILET, undefined, true);

		await changeNow(wrapper, 'centre-x', '50');
		await changeNow(wrapper, 'centre-x', '60');
		await flushPromises();

		expect(midpoint(outlineOfDetail(applied[1], 'detail-2').points).x).toBeCloseTo(60, 6);
	});

	it('rotates about the centre a pending move left the bowl at, not the rendered one', async () => {
		const { wrapper, applied } = mountFor(BOWL, TOILET, undefined, true);

		await changeNow(wrapper, 'centre-x', '50');
		await changeNow(wrapper, 'rotate-by', '90');
		await flushPromises();

		const centre = midpoint(outlineOfDetail(applied[1], 'detail-2').points);
		expect(centre.x).toBeCloseTo(50, 6);
		expect(centre.y).toBeCloseTo(100, 6);
	});
});

describe('what an action commits', () => {
	/**
	 * Critique finding 11: an unavailable reorder is `aria-disabled`, never `disabled` — pressing Send backward
	 * until the detail is last would otherwise disable the button that has focus, and Chromium drops focus to
	 * the page. `NewAssetForm.vue`'s paused controls take the same split.
	 */
	it('marks Bring forward unavailable on the topmost detail and Send backward on the bottom one, disabling neither', () => {
		const top = mountFor(BOWL).wrapper;
		const bottom = mountFor({ kind: 'detail', id: 'detail-1' }).wrapper;

		expect(actionState(top, 'bring-forward')).toEqual(['true', false]);
		expect(actionState(top, 'send-backward')).toEqual([undefined, false]);
		expect(actionState(bottom, 'bring-forward')).toEqual([undefined, false]);
		expect(actionState(bottom, 'send-backward')).toEqual(['true', false]);
	});

	/** A GUARD, green before and after: a press on an unavailable reorder reaches no edit. */
	it('commits nothing for a press on an unavailable reorder', async () => {
		const { wrapper, applied } = mountFor(BOWL);

		await wrapper.find('[name="bring-forward"]').trigger('click');
		await flushPromises();

		expect(applied).toEqual([]);
	});

	it.each([
		['send-backward', BOWL, reorderDetail(TOILET, 'detail-2', 'backward')],
		['bring-forward', { kind: 'detail', id: 'detail-1' }, reorderDetail(TOILET, 'detail-1', 'forward')],
		['delete', BOWL, deleteDetail(TOILET, 'detail-2')],
		['delete', { kind: 'clearance' }, removeClearance(TOILET)],
		['fit-to-details', { kind: 'footprint' }, fitFootprintToDetails(TOILET)],
	] as const)('commits %s on %o', async (name, selection, expected) => {
		const { wrapper, applied } = mountFor(selection);

		await wrapper.find(`[name="${name}"]`).trigger('click');
		await flushPromises();

		expect(applied).toEqual([expected]);
	});

	it('duplicates a detail directly above it and selects the copy', async () => {
		const { wrapper, applied, select } = mountFor(BOWL);

		await wrapper.find('[name="duplicate"]').trigger('click');
		await flushPromises();

		expect(expectOk(applied[0]).details.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(select).toHaveBeenCalledWith({ kind: 'detail', id: 'detail-3' });
	});

	it('selects nothing when the duplicate is refused, and says why', async () => {
		const refusal = err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } as const);
		const { wrapper, select } = mountFor(BOWL, TOILET, refusal);

		await wrapper.find('[name="duplicate"]').trigger('click');
		await flushPromises();

		expect(select).not.toHaveBeenCalled();
		expect(wrapper.find('[role="alert"]').exists()).toBe(true);
	});
});

describe('the inspector in the mounted designer', () => {
	it('writes a typed width through the leaf as one undoable write', async () => {
		const rig = await designerRig({ shape: TOILET });
		try {
			useAssetDesignStore(rig.pinia).select(BOWL);
			await settle();

			const input = rig.wrapper.find('.rp-designer-selection [name="width"]');
			(input.element as HTMLInputElement).value = '608';
			await input.trigger('change');
			await settle();

			const bowl = (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-2');
			expectNear(bowl?.outline.points ?? [], [[-304, 27], [304, 27], [304, 173], [-304, 173]]);
			expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(false);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * Spec Amendment 2: Delete prunes the selection and Duplicate selects the copy, and either unmounts the
	 * section under the very button that was pressed — so focus goes to the inspector rather than to the
	 * page, and the next Tab continues from there. Clearance Delete is the other Delete in the section.
	 */
	it.each([
		['delete', BOWL],
		['delete', { kind: 'clearance' }],
		['duplicate', BOWL],
	] as const)('hands focus to the inspector after %s on %o', async (name, selection) => {
		const rig = await designerRig({ shape: TOILET });
		try {
			const store = useAssetDesignStore(rig.pinia);
			store.select(selection);
			await settle();
			const button = rig.wrapper.find(`.rp-designer-selection [name="${name}"]`).element as HTMLButtonElement;
			button.focus();
			button.click();
			await settleUntil(() => !sameSelection(store.selection, selection), `${name} to land`);
			await settle();

			expect(document.activeElement).toBe(rig.wrapper.find('.rp-designer-inspector aside').element);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * Critique finding 11, mounted: the reorder lands, the button turns unavailable under the focus it still
	 * holds, and a second press writes nothing. jsdom is not known to blur a control that turns disabled, so
	 * the `activeElement` line is a guard; the attribute lines are what fail before the fix.
	 */
	it('keeps focus on Send backward once the detail is last, and a second press writes nothing', async () => {
		const rig = await designerRig({ shape: TOILET });
		try {
			useAssetDesignStore(rig.pinia).select(BOWL);
			await settle();
			const button = rig.wrapper.find('.rp-designer-selection [name="send-backward"]').element as HTMLButtonElement;
			button.focus();
			button.click();
			await settleUntil(async () => (await rig.document()).shape?.details[0]?.id === 'detail-2', 'the reorder to land');
			await settle();

			expect(button.getAttribute('aria-disabled')).toBe('true');
			expect(button.disabled).toBe(false);
			expect(document.activeElement).toBe(button);

			button.click();
			await settle();
			expect((await rig.document()).shape?.details.map((detail) => detail.id)).toEqual(['detail-2', 'detail-1']);
		} finally {
			rig.unmount();
		}
	});
});

/**
 * An OPEN graphic is a part that EXISTS (`selectionExists`), so this section mounts for one.
 *
 * **AD09 withheld its geometry fields and AD11 gives them back**, which is the change these cases
 * are written against: `partMeasure` measures a path through the domain's own `detailBox`, and
 * `moveOutline`/`rotateOutline`/`resizeBox` go through `mapPartOutline`, which keeps a graphic's
 * kind. So centre, size and rotate-by mean for a line what they mean for a ring — the box its
 * geometry reaches.
 *
 * What is NOT given back is a fill: the Line control is drawn and works, and one sentence says that
 * for a line it is a dash pattern and nothing else (C10).
 *
 * `shapeWithOpenGraphic`'s path runs (-300,-200) → (0,-200) → (0,100), so its box is 300 x 300
 * centred on (-150,-50) — both extents positive, which is what makes it the ORDINARY case and why
 * the flat line below is built separately.
 */
describe('an open graphic', () => {
	const OPEN: DesignerSelection = { kind: 'detail', id: 'detail-3' };

	it('draws its name, its line and its ordering actions', () => {
		const { wrapper } = mountFor(OPEN, shapeWithOpenGraphic());

		expect(wrapper.find('[name="detail-name"]').exists()).toBe(true);
		expect(wrapper.find('[name="detail-line"]').exists()).toBe(true);
		expect(wrapper.findAll('.rp-designer-selection-button').map((button) => button.attributes('name'))).toEqual([
			'bring-forward',
			'send-backward',
			'duplicate',
			'delete',
		]);
	});

	it('measures the box its geometry reaches, in the same five fields a closed graphic has', () => {
		const { wrapper } = mountFor(OPEN, shapeWithOpenGraphic());

		expect(wrapper.findAll('input[type="number"]').map((input) => input.attributes('name'))).toEqual([
			'centre-x',
			'centre-y',
			'width',
			'depth',
			'rotate-by',
		]);
		expect(numberFields(wrapper)).toMatchObject({ 'centre-x': '-150', 'centre-y': '-50', width: '300', depth: '300' });
	});

	it('says that solid and dashed are a line’s pattern and never a fill', () => {
		const { wrapper } = mountFor(OPEN, shapeWithOpenGraphic());

		expect(wrapper.find('.rp-designer-open-graphic').text()).toBe(t('en', 'designer.selection.open-graphic'));
		expect(mountFor(BOWL).wrapper.find('.rp-designer-open-graphic').exists()).toBe(false);
	});

	it('moves the whole path when a centre is typed, keeping it open', async () => {
		const { wrapper, applied } = mountFor(OPEN, shapeWithOpenGraphic());

		await change(wrapper, 'centre-x', '0');

		const moved = expectOk(applied[0]).details.find((detail) => detail.id === 'detail-3');
		expect(moved?.kind).toBe('open');
		expect(moved?.outline.points).toEqual([{ x: -150, y: -200 }, { x: 150, y: -200 }, { x: 150, y: 100 }]);
	});

	it('resizes it to the typed extent about its own box centre', async () => {
		const { wrapper, applied } = mountFor(OPEN, shapeWithOpenGraphic());

		await change(wrapper, 'width', '600');

		const resized = expectOk(applied[0]).details.find((detail) => detail.id === 'detail-3');
		expect(resized?.outline.points).toEqual([{ x: -450, y: -200 }, { x: 150, y: -200 }, { x: 150, y: 100 }]);
	});

	/**
	 * A FLAT line is the one case a size field cannot answer, and it is reachable only here: a closed
	 * graphic must enclose an area, so both of its extents are positive. A scale about the box centre
	 * multiplies the distance from it, and every point of a horizontal line is zero from it along y —
	 * so the field says why rather than appearing to do nothing, which is C12's rule.
	 */
	it('refuses a depth for a flat line, and says why, rather than solving forever', async () => {
		const { wrapper, applied } = mountFor(OPEN, flatLine());

		expect(numberFields(wrapper).depth).toBe('0');
		await change(wrapper, 'depth', '400');

		expect(applied[0].ok).toBe(false);
		expect(wrapper.find('[role="alert"]').text()).toBe(t('en', 'asset.extent-not-scalable'));
	});

	it('still stretches the axis it does have', async () => {
		const { wrapper, applied } = mountFor(OPEN, flatLine());

		await change(wrapper, 'width', '1200');

		const resized = expectOk(applied[0]).details.find((detail) => detail.id === 'detail-3');
		expect(resized?.outline.points).toEqual([{ x: -600, y: 0 }, { x: 600, y: 0 }]);
	});
});
