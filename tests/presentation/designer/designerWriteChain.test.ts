/**
 * @vitest-environment jsdom
 *
 * One write chain for every designer gesture (asset designer symbols spec, Amendment 2), MOUNTED: a
 * gesture made before the previous gesture's write has been read back composes with it, rather than
 * being refused as a version conflict against the user's own earlier gesture — and a drag stays
 * conditional on the design the user pressed on (Amendment 1).
 *
 * The composing cases put NO `settle()` between their gestures: that gap is the subject. Every press
 * target is derived from the toilet preset and sits more than the rig's 80 mm grab radius from every
 * handle of the selected bowl, moved or not — a press near a handle would resize the bowl instead.
 */
import { describe, expect, it } from 'vitest';
import type { Point } from '../../../src/core/geometry/Point';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { expectOk } from '../../helpers/domain';
import { settle } from '../../helpers/editor';
import { designerRig, drag, type DesignerRig } from '../../helpers/designerRig';
import { TOILET, detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const BOWL = detailOutline('detail-2');
/** (0, 163): inside the bowl, 162 mm above its box's bottom-middle handle. */
const IN_BOWL = justInsideBottom(BOWL);
/** The same point on the bowl once it has moved 100 mm right — still 162 mm or more from every handle of it. */
const IN_MOVED_BOWL = { x: IN_BOWL.x + 100, y: IN_BOWL.y };
const FURTHER = { x: IN_BOWL.x + 200, y: IN_BOWL.y };
/** Two corners outside the footprint, more than the 80 mm snap tolerance from every vertex the toilet has. */
const RECT_FROM = { x: -300, y: 600 };
const RECT_TO = { x: -200, y: 800 };

async function toolbar(rig: DesignerRig, label: StringKey): Promise<void> {
	rig.toolbarButton(t('en', label)).click();
	await settle();
}

/** A press on `from` and a move to `to` with the primary button held: a drag whose release has not come yet. */
function pressAndMove(rig: DesignerRig, from: Point, to: Point): void {
	for (const [type, world] of [['pointerdown', from], ['pointermove', to]] as const) {
		const at = rig.at(world);
		rig.canvasEl.dispatchEvent(new PointerEvent(type, { button: 0, buttons: 1, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
	}
}

/** The release that ends `pressAndMove`'s drag, with the primary bit clear as a device sends it. */
function release(rig: DesignerRig, world: Point): void {
	const at = rig.at(world);
	rig.canvasEl.dispatchEvent(new PointerEvent('pointerup', { button: 0, buttons: 0, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }));
}

function tap(rig: DesignerRig, key: string): void {
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** The bowl as written, `dx` mm right of the preset's — within a micrometre, since a rig point crosses the camera twice. */
async function expectBowlMoved(rig: DesignerRig, dx: number): Promise<void> {
	const points = (await rig.document()).shape?.details.find((detail) => detail.id === 'detail-2')?.outline.points;
	expect(points).toHaveLength(BOWL.points.length);
	BOWL.points.forEach((point, index) => {
		expect(points?.[index]?.x).toBeCloseTo(point.x + dx, 6);
		expect(points?.[index]?.y).toBeCloseTo(point.y, 6);
	});
}

async function detailIds(rig: DesignerRig): Promise<string[] | undefined> {
	return (await rig.document()).shape?.details.map((detail) => detail.id);
}

describe('gestures made before the last write lands', () => {
	it('compose a second drag with the first: the bowl ends 200 mm right, and nothing is refused', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		drag(rig, IN_MOVED_BOWL, FURTHER);
		await settle();

		await expectBowlMoved(rig, 200);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});

	it('compose an arrow tap with a drag: 110 mm, and two undo entries', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		tap(rig, 'ArrowRight');
		await settle();
		await expectBowlMoved(rig, 110);

		await toolbar(rig, 'designer.toolbar.undo');
		await expectBowlMoved(rig, 100);
		await toolbar(rig, 'designer.toolbar.undo');
		await expectBowlMoved(rig, 0);
		expect(rig.toolbarButton(t('en', 'designer.toolbar.undo')).disabled).toBe(true);
		rig.unmount();
	});

	it('compose a drag made after a manual switch to Select with the detail drawn just before it', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.draw-rect');

		drag(rig, RECT_FROM, RECT_TO);
		// Not awaited: Select is chosen while the drawn detail's write is still queued.
		rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		await settle();

		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});

	it('compose a detail drawn straight after a drag with that drag', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		rig.toolbarButton(t('en', 'designer.toolbar.draw-rect')).click();
		drag(rig, RECT_FROM, RECT_TO);
		await settle();

		expect(await detailIds(rig)).toEqual(['detail-1', 'detail-2', 'detail-3']);
		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});
});

describe('a press held behind a queued write', () => {
	/**
	 * Green before the chain existed too — Escape cancelled the live drag then. What it pins is that
	 * `cancel` drops a HELD press, so nothing replays it once the write lands: drop that and the bowl
	 * ends 200 mm right.
	 */
	it('is abandoned by Escape, and never replayed', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		pressAndMove(rig, IN_MOVED_BOWL, FURTHER);
		tap(rig, 'Escape');
		release(rig, FURTHER);
		await settle();

		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});

	/**
	 * The ordering Amendment 2's peer bullet builds on: a peer write that lands WHILE the second press is
	 * held — after that press was made, and before the chain has drained. Measured, it lands ahead of the
	 * first drag's own write, which refuses that write (its press never read the peer's). The chain's
	 * read-back then brings the peer's change in before the replay, so the replayed press reads the
	 * peer's version and its drag lands on top of the peer's change: the peer's facing is kept, the
	 * held drag's 100 mm is applied, and its write is saved. The case below is the other ordering, a
	 * peer write during the LIVE (replayed) drag.
	 */
	it('builds a drag held behind a write on a peer write that landed during the hold', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		// Held, release included, behind the first drag's queued write.
		drag(rig, IN_MOVED_BOWL, FURTHER);
		expectOk(await rig.peer.setFacing.execute({ assetId: rig.assetId, facing: 0 }));
		// The peer's write has landed and neither drag has written yet.
		await expectBowlMoved(rig, 0);
		await settle();

		expect((await rig.document()).shape?.facing).toBe(0);
		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('saved');
		rig.unmount();
	});

	/**
	 * A peer write during a LIVE drag — the held press has already been replayed, so the peer's write
	 * is one that press never read. Green before the chain existed too, for the refusal's own reason.
	 * What it pins is Amendment 1's press-read version surviving the replay: mutant M2, a release made
	 * conditional on the version the store holds AT RELEASE — the peer's, once its refresh has landed —
	 * writes over the peer's facing.
	 */
	it('stays conditional on the design it was replayed on, so a peer write during the live replayed drag refuses it', async () => {
		const rig = await designerRig({ shape: TOILET });
		await toolbar(rig, 'designer.toolbar.select');

		drag(rig, IN_BOWL, IN_MOVED_BOWL);
		pressAndMove(rig, IN_MOVED_BOWL, FURTHER);
		// The first write lands, and the held press is replayed on the design it left.
		await settle();
		expectOk(await rig.peer.setFacing.execute({ assetId: rig.assetId, facing: 0 }));
		// The peer's refresh lands too: the store now holds a newer version than the press read.
		await settle();
		expect(useAssetDesignStore(rig.pinia).design?.shape?.facing).toBe(0);
		release(rig, FURTHER);
		await settle();

		expect((await rig.document()).shape?.facing).toBe(0);
		await expectBowlMoved(rig, 100);
		expect(useSaveStateStore(rig.pinia).state).toBe('save-error');
		rig.unmount();
	});
});
