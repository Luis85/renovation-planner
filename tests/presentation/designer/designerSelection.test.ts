/**
 * @vitest-environment jsdom
 *
 * The designer's Select tool, MOUNTED (symbols spec, Decision 10): reached through the real toolbar,
 * driven by pointer streams a hand can produce, writing through the real reversible adapter to a real
 * sidecar. `tools/designerSelectTool.test.ts` is the unit half; this file is what proves a user can get
 * to any of it, and that what it writes is one undoable, conditional revision.
 *
 * Every coordinate is read from the toilet preset (`tests/helpers/designerSelection.ts`). At the rig's
 * camera one pixel is ten millimetres, so the grab radius is 80 mm and the click epsilon 40 mm.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { Notice } from '../../helpers/obsidian-mock';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { click, designerRig, drag, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const TANK = detailOutline('detail-1');
const BOWL = detailOutline('detail-2');
const IN_BOWL = justInsideBottom(BOWL);
const IN_TANK = justInsideBottom(TANK);

async function press(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

async function detailPoints(rig: DesignerRig, id: string): Promise<readonly Point[] | undefined> {
	return (await rig.document()).shape?.details.find((detail) => detail.id === id)?.outline.points;
}

/** Point-for-point within a micrometre: a rig point crosses the camera twice on its way to the tool. */
function expectNear(actual: readonly Point[] | undefined, expected: readonly Point[]): void {
	expect(actual).toHaveLength(expected.length);
	expected.forEach((point, index) => {
		expect(actual?.[index]?.x).toBeCloseTo(point.x, 6);
		expect(actual?.[index]?.y).toBeCloseTo(point.y, 6);
	});
}

/**
 * One pointer event with the primary bit as a device sets it: held on a press and a move, clear on the
 * release. The stale-read case needs to await between the moves and the release, which `drag()` cannot.
 */
function pointer(rig: DesignerRig, type: 'pointerdown' | 'pointermove' | 'pointerup', world: Point): void {
	const at = rig.at(world);
	rig.canvasEl.dispatchEvent(
		new PointerEvent(type, { button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }),
	);
}

describe('selecting a part', () => {
	it('selects the bowl with a click, and writes nothing', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		const before = await rig.document();

		click(rig, IN_BOWL);
		await settle();

		expect(useAssetDesignStore(rig.pinia).selection).toEqual({ kind: 'detail', id: 'detail-2' });
		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});

	it('selects nothing and writes nothing on an asset that has no shape yet', async () => {
		const rig = await designerRig({ shape: null });
		await press(rig, 'designer.toolbar.select');

		click(rig, { x: 0, y: 0 });
		await settle();

		expect(useAssetDesignStore(rig.pinia).selection).toBeNull();
		expect((await rig.document()).shape).toBeNull();
		rig.unmount();
	});
});

describe('dragging a selected part', () => {
	it('moves the bowl in one write that one Undo takes back', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, { x: IN_BOWL.x + 100, y: IN_BOWL.y });
		await settle();
		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points.map((point) => ({ x: point.x + 100, y: point.y })));

		await press(rig, 'designer.toolbar.undo');

		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points);
		// Nothing left to undo: the drag was exactly one history entry.
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		rig.unmount();
	});

	/**
	 * A click made while a drag's write is still in flight must not clear the drag's preview: the design
	 * is still the pre-write one, so the canvas would draw the bowl back where it started until the
	 * refresh lands. The drag's own commit clears the preview once its write has settled.
	 */
	it('leaves a drag’s preview standing when a click lands before its write does', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		const moved = { x: IN_BOWL.x + 100, y: IN_BOWL.y };

		drag(rig, IN_BOWL, moved);
		click(rig, moved);
		expect(useAssetDesignStore(rig.pinia).preview).not.toBeNull();

		await settle();
		expect(useAssetDesignStore(rig.pinia).preview).toBeNull();
		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points.map((point) => ({ x: point.x + 100, y: point.y })));
		rig.unmount();
	});

	/**
	 * PBI extension 4b: a drag made against a design a peer has since rewritten is REFUSED rather than
	 * overwriting the peer. The peer's write lands between the press — which read the old version — and
	 * the release, so the refusal is the version check's and not a race's.
	 */
	it('refuses a drag made against a design a peer rewrote mid-gesture', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		click(rig, IN_BOWL);
		await settle();
		// After the mount, which installs the DOM the notice queue draws into.
		activateNotices();
		const notices = Notice.shown.length;

		const peerWrite = rig.peer.setFacing.execute({ assetId: rig.assetId, facing: 0 });
		pointer(rig, 'pointerdown', IN_BOWL);
		pointer(rig, 'pointermove', { x: IN_BOWL.x + 50, y: IN_BOWL.y });
		pointer(rig, 'pointermove', { x: IN_BOWL.x + 100, y: IN_BOWL.y });
		expectOk(await peerWrite);
		pointer(rig, 'pointerup', { x: IN_BOWL.x + 100, y: IN_BOWL.y });
		await settle();

		const shape = (await rig.document()).shape;
		expect(shape?.facing).toBe(0);
		expectNear(await detailPoints(rig, 'detail-2'), BOWL.points);
		// What the user is shown: a write-boundary refusal goes to the save indicator and to no notice
		// beside it (`reportDispatchFailure`). That the tool REPORTED it is `designerSelectTool.test.ts`'s
		// `rig.rejected` case — this reporter shows nothing for this code, so no DOM assertion can see it.
		expect(useSaveStateStore(rig.pinia).state).toBe('save-error');
		expect(Notice.shown).toHaveLength(notices);
		rig.unmount();
	});

	it('snaps a dragged vertex onto a footprint vertex in Edit points', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		click(rig, IN_TANK);
		await settle();
		await press(rig, 'designer.selection.mode.points');
		const corner = TOILET.footprint.points[2];

		drag(rig, TANK.points[2], { x: corner.x - 10, y: corner.y - 10 });
		await settle();

		expect(await detailPoints(rig, 'detail-1')).toEqual([TANK.points[0], TANK.points[1], corner, TANK.points[3]]);
		rig.unmount();
	});
});

describe('the mode control', () => {
	it('is offered only for a selected outline under Select, and switches the mode', async () => {
		const rig = await designerRig({ shape: TOILET });
		const modes = () => rig.wrapper.find('.rp-designer-selection-modes');
		const store = useAssetDesignStore(rig.pinia);
		await press(rig, 'designer.toolbar.select');
		expect(modes().exists()).toBe(false);

		click(rig, IN_BOWL);
		await settle();
		// A group of toggle buttons, like the toolbar around it — not a radiogroup, which would owe
		// roving focus and arrow keys this control does not have.
		expect(modes().attributes('role')).toBe('group');
		expect(modes().attributes('aria-label')).toBe(t('en', 'designer.selection.mode'));
		expect(modes().findAll('button').map((button) => button.text())).toEqual([
			t('en', 'designer.selection.mode.transform'),
			t('en', 'designer.selection.mode.points'),
			t('en', 'designer.selection.mode.bend'),
		]);
		expect(modes().find('[aria-pressed="true"]').text()).toBe(t('en', 'designer.selection.mode.transform'));

		await press(rig, 'designer.selection.mode.points');
		expect(store.mode).toBe('points');
		expect(modes().find('[aria-pressed="true"]').text()).toBe(t('en', 'designer.selection.mode.points'));

		// The anchor is a point, not an outline: no modes for it.
		click(rig, TOILET.anchor);
		await settle();
		expect(modes().exists()).toBe(false);

		// And none under any other tool, whatever is selected.
		click(rig, IN_BOWL);
		await settle();
		await press(rig, 'designer.toolbar.pan');
		expect(modes().exists()).toBe(false);
		rig.unmount();
	});
});

describe('bending an edge', () => {
	it('bows the tank’s top edge in one write under Bend edges', async () => {
		const rig = await designerRig({ shape: TOILET });
		await press(rig, 'designer.toolbar.select');
		click(rig, IN_TANK);
		await settle();
		await press(rig, 'designer.selection.mode.bend');
		const top = { x: (TANK.points[0].x + TANK.points[1].x) / 2, y: TANK.points[0].y };

		drag(rig, top, { x: top.x, y: top.y - 50 });
		await settle();

		const tank = (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-1')?.outline;
		expect(tank?.bulges?.[0]).toBeCloseTo((2 * 50) / (TANK.points[1].x - TANK.points[0].x), 6);
		expect(tank?.bulges?.slice(1)).toEqual([0, 0, 0]);
		rig.unmount();
	});
});
