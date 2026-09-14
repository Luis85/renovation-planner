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
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
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
import { toiletShape } from '../../helpers/assetShapes';
import { expectOk } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { designerRig } from '../../helpers/designerRig';

type ShapeEdit = (shape: AssetShape) => Result<AssetShape, ValidationError>;

const TOILET = toiletShape();

const BOWL: DesignerSelection = { kind: 'detail', id: 'detail-2' };

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
	it('disables Bring forward on the topmost detail and Send backward on the bottom one', () => {
		const top = mountFor(BOWL).wrapper;
		const bottom = mountFor({ kind: 'detail', id: 'detail-1' }).wrapper;

		expect((top.find('[name="bring-forward"]').element as HTMLButtonElement).disabled).toBe(true);
		expect((top.find('[name="send-backward"]').element as HTMLButtonElement).disabled).toBe(false);
		expect((bottom.find('[name="bring-forward"]').element as HTMLButtonElement).disabled).toBe(false);
		expect((bottom.find('[name="send-backward"]').element as HTMLButtonElement).disabled).toBe(true);
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
});
