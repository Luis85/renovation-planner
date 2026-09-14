/**
 * @vitest-environment jsdom
 *
 * The designer's selection keys, MOUNTED (symbols spec, Decision 10): Delete and Ctrl+D on the canvas
 * region, the arrows through `EditorSurface`'s own nudge, each one conditional `SetAssetShape` and one
 * undo entry, written to a real sidecar. `designerKeys.test.ts` holds the decisions and the arms.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { settle } from '../../helpers/editor';
import { click, designerRig, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const BOWL = detailOutline('detail-2');

function key(target: Element, init: KeyboardEventInit): void {
	target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

async function selectAt(rig: DesignerRig, world: Point): Promise<void> {
	await press(rig, 'designer.toolbar.select');
	click(rig, world);
	await settle();
}

async function bowlPoints(rig: DesignerRig): Promise<readonly Point[] | undefined> {
	return (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-2')?.outline.points;
}

/** One primary pointer event, held on the press and clear on the release — a press whose release has not come yet. */
function pointer(rig: DesignerRig, type: 'pointerdown' | 'pointerup', world: Point): void {
	const at = rig.at(world);
	rig.canvasEl.dispatchEvent(
		new PointerEvent(type, { button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }),
	);
}

describe('Delete', () => {
	it('deletes the selected detail, and the selection goes with it', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));

		key(rig.canvasEl, { key: 'Delete' });
		await settle();

		expect((await rig.document()).shape?.details.map((detail) => detail.id)).toEqual(['detail-1']);
		expect(useAssetDesignStore(rig.pinia).selection).toBeNull();
		rig.unmount();
	});

	it('removes the selected clearance with Backspace', async () => {
		const rig = await designerRig({ shape: TOILET });
		const corner = TOILET.clearance?.points[2] as Point;
		// Inside the clearance's far corner: outside the footprint and every detail.
		await selectAt(rig, { x: corner.x - 50, y: corner.y - 50 });
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'clearance' });

		key(rig.canvasEl, { key: 'Backspace' });
		await settle();

		expect((await rig.document()).shape?.clearance).toBeNull();
		rig.unmount();
	});

	it('does nothing to the footprint, which cannot be deleted', async () => {
		const rig = await designerRig({ shape: TOILET });
		// Inside the footprint, right of the bowl and below the tank.
		await selectAt(rig, { x: TOILET.footprint.points[1].x - 15, y: 0 });
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'footprint' });
		const before = await rig.document();

		key(rig.canvasEl, { key: 'Delete' });
		await settle();

		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});

	it('deletes nothing for a Backspace typed in the inspector, a sibling of the canvas region', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));
		const height = rig.wrapper.find('.rp-designer-inspector input[name="height"]');

		key(height.element, { key: 'Backspace' });
		await settle();

		expect((await rig.document()).shape?.details).toHaveLength(2);
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-2' });
		rig.unmount();
	});
});

/**
 * The listener acts only under Select with no gesture in flight — `EditorSurface`'s arrow door asks the
 * same. Backspace is a trace's own word for "take that point back" in every drawing tool, so a user
 * mid-trace with a detail still selected must not lose the detail to it; and a Delete pressed while a
 * drag of the selection is still held would delete the part the release is about to write.
 */
describe('the selection keys outside a resting Select', () => {
	it('deletes nothing for a Backspace pressed mid-trace', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));
		await press(rig, 'designer.toolbar.trace-footprint');
		// Far outside the toilet, so the vertex snaps to nothing.
		click(rig, { x: 2000, y: 2000 });
		await settle();
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-2' });

		key(rig.canvasEl, { key: 'Backspace' });
		await settle();

		expect((await rig.document()).shape?.details).toHaveLength(2);
		rig.unmount();
	});

	it('deletes nothing for a Delete pressed while a press on the selection is still held', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');

		pointer(rig, 'pointerdown', justInsideBottom(BOWL));
		key(rig.canvasEl, { key: 'Delete' });
		pointer(rig, 'pointerup', justInsideBottom(BOWL));
		await settle();

		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-2' });
		expect((await rig.document()).shape?.details).toHaveLength(2);
		rig.unmount();
	});

	it('moves nothing for an arrow under another tool, even with nothing drawn yet', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));
		await press(rig, 'designer.toolbar.trace-footprint');
		const before = await rig.document();

		key(rig.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});

	it('deletes nothing for a Delete from a control inside the canvas, which that control owns', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));
		// Planted in the surface's overlay, where the empty state's action button lives: a descendant of
		// the canvas element that is not the canvas element.
		const control = document.createElement('button');
		rig.canvasEl.querySelector('.rp-plan-overlay')?.append(control);

		key(control, { key: 'Delete' });
		await settle();

		expect((await rig.document()).shape?.details).toHaveLength(2);
		rig.unmount();
	});
});

describe('Ctrl+D', () => {
	it('adds a copy 100 mm down and right, selects it, and one Undo removes it', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));

		key(rig.canvasEl, { key: 'd', ctrlKey: true });
		await settle();

		const details = (await rig.document()).shape?.details;
		expect(details?.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		expect(details?.[2]?.outline.points).toEqual(BOWL.points.map((point) => ({ x: point.x + 100, y: point.y + 100 })));
		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-3' });

		await press(rig, 'designer.toolbar.undo');
		expect((await rig.document()).shape?.details).toHaveLength(2);
		rig.unmount();
	});
});

describe('the arrow keys', () => {
	it('nudge a detail 10 mm, or 100 mm with Shift, one undo entry each', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));

		key(rig.canvasEl, { key: 'ArrowRight' });
		await settle();
		key(rig.canvasEl, { key: 'ArrowDown', shiftKey: true });
		await settle();
		expect(await bowlPoints(rig)).toEqual(BOWL.points.map((point) => ({ x: point.x + 10, y: point.y + 100 })));

		await press(rig, 'designer.toolbar.undo');
		expect(await bowlPoints(rig)).toEqual(BOWL.points.map((point) => ({ x: point.x + 10, y: point.y })));
		await press(rig, 'designer.toolbar.undo');
		expect(await bowlPoints(rig)).toEqual(BOWL.points);
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		rig.unmount();
	});

	it('compose two taps pressed before the first write lands: 20 mm, and two undo entries', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, justInsideBottom(BOWL));

		key(rig.canvasEl, { key: 'ArrowRight' });
		key(rig.canvasEl, { key: 'ArrowRight' });
		await settle();
		expect(await bowlPoints(rig)).toEqual(BOWL.points.map((point) => ({ x: point.x + 20, y: point.y })));

		await press(rig, 'designer.toolbar.undo');
		expect(await bowlPoints(rig)).toEqual(BOWL.points.map((point) => ({ x: point.x + 10, y: point.y })));
		await press(rig, 'designer.toolbar.undo');
		expect(await bowlPoints(rig)).toEqual(BOWL.points);
		rig.unmount();
	});

	it('move a selected anchor, and leave a selected facing alone', async () => {
		const rig = await designerRig({ shape: TOILET });
		await selectAt(rig, TOILET.anchor);

		key(rig.canvasEl, { key: 'ArrowLeft' });
		await settle();
		expect((await rig.document()).shape?.anchor).toEqual({ x: TOILET.anchor.x - 10, y: TOILET.anchor.y });

		const store = useAssetDesignStore(rig.pinia);
		store.select({ kind: 'facing' });
		const before = await rig.document();
		key(rig.canvasEl, { key: 'ArrowUp' });
		await settle();

		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});
});
