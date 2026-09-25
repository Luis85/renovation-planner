/**
 * @vitest-environment jsdom
 *
 * AD18-R24: a TYPED size that lands away from the number typed raises a warning naming the size that landed, at
 * every door that types one — the inspector's Width and Depth, the canvas's size labels and Set dimensions' scaling
 * path — while a box-handle drag that lands the same way stays silent (the pointer is its feedback).
 *
 * Driven through `designerRig`, the real designer over the real command bundle and the in-memory sidecar, so what a
 * case measures is what was WRITTEN. The Set dimensions dialog is the one thing faked, as `assetDimensions.test.ts`
 * fakes it: typing into a mounted `AssetDimensionsDialog` is `dialogKinds.test.ts`'s subject.
 *
 * `QUAD` is `selectionDragCurved.test.ts`'s seeded find: a 400 x 300 quad with bulges whose kept arcs meet below
 * about 202.5 wide at its full depth, so a typed Width 67 lands near 202.5. Here it is the FOOTPRINT, with nothing
 * else in the design, so all three doors and the drag act on one part and the whole-design scale has no detail to
 * carry. Its curve-aware box is 400 x 690 about (0, 5).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { ASSET_PRESETS } from '../../../src/domain/asset/presets/catalogue';
import { defaultValues, rect } from '../../../src/domain/asset/presets/presetGeometry';
import type { OutlinePart } from '../../../src/domain/asset/shapeEdits';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { partMeasure, resizeToExtent, type PartBox } from '../../../src/presentation/designer/selection/partExtent';
import type { EditShape } from '../../../src/presentation/designer/selection/editShape';
import { landTyped } from '../../../src/presentation/designer/selection/typedLanding';
import { ok } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { editableShape } from '../../helpers/assetShapes';
import { designerRig, drag, type DesignerRig } from '../../helpers/designerRig';
import { installObsidianDom } from '../../helpers/dom';
import { expectDefined, expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { Notice } from '../../helpers/obsidian-mock';

const QUAD = { points: rect(400, 300).points, bulges: [0.95, -0.4, 1, -0.95] };
const FOOTPRINT: OutlinePart = { kind: 'footprint' };

const quadDesign = (): AssetShape => editableShape({ footprint: QUAD, details: [], clearance: null });

/** Opened framed, so the overall labels rest on the canvas; the drag reads its pixels off the live camera. */
const designer = (options: Parameters<typeof designerRig>[0] = {}): Promise<DesignerRig> =>
	designerRig({ shape: quadDesign(), camera: 'opened', ...options });

/** The footprint's curve-aware box as the sidecar holds it: what was written, measured as the doors measure it. */
async function written(rig: DesignerRig): Promise<PartBox> {
	const shape = expectDefined((await rig.document()).shape ?? undefined, 'a written shape');
	return partMeasure(shape, FOOTPRINT) as PartBox;
}

/** The notice this feature raises for `box`, in whole millimetres like the fields. */
const landedNotice = (box: PartBox): string =>
	t('en', 'designer.typed-size.landed', { width: String(Math.round(box.width)), depth: String(Math.round(box.depth)) });

let shownBefore = 0;
/** The notices raised since the case began. */
const raised = (): readonly string[] => Notice.shown.slice(shownBefore);

beforeEach(() => {
	// The notice regions are built with Obsidian's DOM helpers, which the rig installs only once it mounts.
	installObsidianDom();
	activateNotices();
	shownBefore = Notice.shown.length;
});

async function typeIntoInspector(rig: DesignerRig, name: 'width' | 'depth', value: string, part: OutlinePart = FOOTPRINT): Promise<void> {
	useAssetDesignStore(rig.pinia).select(part);
	await settle();
	const input = rig.wrapper.find(`.rp-designer-selection [name="${name}"]`);
	(input.element as HTMLInputElement).value = value;
	await input.trigger('change');
	await settle();
}

async function typeIntoLabel(rig: DesignerRig, name: string, value: string): Promise<void> {
	(rig.wrapper.get(`.rp-designer-dimensions [data-rp-dimension="${name}"]`).element as HTMLButtonElement).click();
	await settle();
	await rig.wrapper.get('.rp-designer-dimension__form input').setValue(value);
	await rig.wrapper.get('.rp-designer-dimension__form').trigger('submit');
	await settle();
}

async function setDimensions(rig: DesignerRig, width: number, depth: number): Promise<void> {
	vi.spyOn(useDialogStore(rig.pinia), 'openDialog').mockResolvedValue({ width, depth });
	await rig.wrapper.get('.rp-designer-edit-dimensions').trigger('click');
	await settle();
}

describe('the inspector’s Width and Depth', () => {
	it('warns with the landed size when a typed Width lands away from it', async () => {
		const rig = await designer();
		try {
			await typeIntoInspector(rig, 'width', '67');
			const box = await written(rig);
			expect(box.width).toBeGreaterThan(202.4);
			expect(box.width).toBeLessThan(202.52);
			expect(raised()).toEqual([landedNotice(box)]);
		} finally {
			rig.unmount();
		}
	});

	it('warns for a typed Depth the arcs cannot reach', async () => {
		const rig = await designer();
		try {
			await typeIntoInspector(rig, 'depth', '100');
			const box = await written(rig);
			expect(box.depth).toBeGreaterThan(300);
			expect(raised()).toEqual([landedNotice(box)]);
		} finally {
			rig.unmount();
		}
	});

	/**
	 * One a user reaches without drawing anything (and the harness at `?view=asset-designer&preset=vanity&writable`):
	 * the vanity preset's basin, a stadium whose two half-circle ends span 270 between them, typed to Width 191.
	 */
	it('warns on a preset part too: the vanity’s basin typed narrower than its ends', async () => {
		const vanity = expectDefined(ASSET_PRESETS.find((preset) => preset.id === 'vanity'), 'the vanity preset');
		const shape = expectOk(vanity.build(defaultValues(vanity)));
		const basin: OutlinePart = { kind: 'detail', id: expectDefined(shape.details.find((detail) => detail.name === 'basin'), 'the basin').id };
		const rig = await designerRig({ shape, camera: 'opened' });
		try {
			await typeIntoInspector(rig, 'width', '191', basin);
			const box = partMeasure(expectDefined((await rig.document()).shape ?? undefined, 'a written shape'), basin) as PartBox;
			expect(box.width).toBeGreaterThan(270);
			expect(raised()).toEqual([landedNotice(box)]);
		} finally {
			rig.unmount();
		}
	});

	it('lands a reachable Width and says nothing', async () => {
		const rig = await designer();
		try {
			await typeIntoInspector(rig, 'width', '300');
			expect((await written(rig)).width).toBeCloseTo(300, 6);
			expect(raised()).toEqual([]);
		} finally {
			rig.unmount();
		}
	});

	it('keeps a refusal its own message and raises no landing warning', async () => {
		const rig = await designer({ unrecoveredSettings: true });
		try {
			await typeIntoInspector(rig, 'width', '67');
			expect((await written(rig)).width).toBeCloseTo(400, 6);
			expect(rig.wrapper.find('.rp-designer-selection [role="alert"]').exists()).toBe(true);
			// What the edit would have landed, had the write gone through: the warning a refusal must not raise.
			const would = partMeasure(expectOk(resizeToExtent(quadDesign(), FOOTPRINT, 'width', 67)), FOOTPRINT) as PartBox;
			expect(raised()).not.toContain(landedNotice(would));
		} finally {
			rig.unmount();
		}
	});
});

describe('the canvas’s size labels', () => {
	it('warns with the landed size when a typed overall width lands away from it', async () => {
		const rig = await designer();
		try {
			await typeIntoLabel(rig, 'overall-width', '67');
			const box = await written(rig);
			expect(box.width).toBeGreaterThan(202.4);
			expect(raised()).toEqual([landedNotice(box)]);
		} finally {
			rig.unmount();
		}
	});

	it('lands a reachable width and says nothing', async () => {
		const rig = await designer();
		try {
			await typeIntoLabel(rig, 'overall-width', '300');
			expect((await written(rig)).width).toBeCloseTo(300, 6);
			expect(raised()).toEqual([]);
		} finally {
			rig.unmount();
		}
	});

	it('dispatches nothing and says nothing for the size it already shows (C03)', async () => {
		const rig = await designer();
		try {
			await typeIntoLabel(rig, 'overall-width', '400');
			// A write of the very same shape would still push an undo entry, so that is what is asked.
			expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
			expect(raised()).toEqual([]);
		} finally {
			rig.unmount();
		}
	});
});

describe('Set dimensions', () => {
	it('warns with the landed size when the typed pair lands away from it', async () => {
		const rig = await designer();
		try {
			await setDimensions(rig, 67, 690);
			const box = await written(rig);
			expect(box.width).toBeGreaterThan(202.4);
			expect(raised()).toEqual([landedNotice(box)]);
		} finally {
			rig.unmount();
		}
	});

	it('lands a reachable pair and says nothing', async () => {
		const rig = await designer();
		try {
			await setDimensions(rig, 300, 690);
			const box = await written(rig);
			expect(box.width).toBeCloseTo(300, 6);
			expect(box.depth).toBeCloseTo(690, 6);
			expect(raised()).toEqual([]);
		} finally {
			rig.unmount();
		}
	});
});

describe('a box-handle drag', () => {
	it('lands away from the pointer the way a typed Width does, and says nothing', async () => {
		const rig = await designer();
		try {
			useAssetDesignStore(rig.pinia).select(FOOTPRINT);
			await settle();
			// The right-middle handle, pulled to ask about 67 wide with the left side held at -200.
			const handle: Point = { x: 200, y: 5 };
			drag(rig, handle, { x: -133, y: 5 });
			await settle();
			const box = await written(rig);
			expect(box.width).toBeGreaterThan(202.4);
			expect(box.width).toBeLessThan(202.52);
			expect(raised()).toEqual([]);
		} finally {
			rig.unmount();
		}
	});
});

/** A leaf whose every write goes through, so the boundary is asked of the landed shape alone. */
const writes: EditShape = (edit) => {
	edit(editableShape());
	return Promise.resolve(ok('wrote'));
};

describe('the half-millimetre threshold', () => {
	it.each([
		[1000.5, false],
		[1000.51, true],
		[999.49, true],
	])('a Width typed 1000 that lands at %d warns: %s', async (landed, warns) => {
		await landTyped(writes, { part: FOOTPRINT, width: 1000 }, () => ok(editableShape({ footprint: rect(landed, 600) })));
		expect(raised()).toEqual(warns ? [t('en', 'designer.typed-size.landed', { width: String(Math.round(landed)), depth: '600' })] : []);
	});
});
