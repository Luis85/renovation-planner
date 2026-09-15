/**
 * @vitest-environment jsdom
 *
 * Snapping and the grid in the MOUNTED designer (asset designer snapping spec 2026-09-15, §4.3 and §5): the runtime
 * supplies the grid only while it is shown and follows the Snap choice, the gesture layer draws the guides a tool
 * publishes, and the grid is drawn above the stage from the footprint's corner. The arithmetic is
 * `snapServiceGuides.test.ts`'s and `designerSelectSnapping.test.ts`'s; this file is the wiring nothing else mounts.
 *
 * At the rig's default camera a pixel is 10 mm, so the tolerance is 80 mm and the grid step 500 mm.
 */
import { describe, expect, it } from 'vitest';
import { boundingBoxOf } from '../../../src/core/geometry/operations';
import { unwrap } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { toiletShape } from '../../helpers/assetShapes';
import { settle } from '../../helpers/editor';
import { click, designerRig, drag, move } from '../../helpers/designerRig';
import { detailOutline, justInsideBottom } from '../../helpers/designerSelection';

const TANK = detailOutline('detail-1');
const PRESS = justInsideBottom(TANK);
/** Far from every part: the tank's corner arrives at (1040, 660), with no target within 80 mm. */
const TRAVEL = { x: 1230, y: 1010 };
const FOOTPRINT_MIN = unwrap(boundingBoxOf(toiletShape().footprint)).min;

async function selectRig() {
	const rig = await designerRig({ shape: toiletShape() });
	rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
	await settle();
	return rig;
}

describe('the grid in the mounted designer', () => {
	it('moves a part by the raw travel while the grid is hidden', async () => {
		const rig = await selectRig();
		try {
			drag(rig, PRESS, { x: PRESS.x + TRAVEL.x, y: PRESS.y + TRAVEL.y });
			await settle();

			const corner = (await rig.document()).shape?.details[0]?.outline.points[0];
			expect(corner?.x).toBeCloseTo(TANK.points[0].x + TRAVEL.x, 6);
			expect(corner?.y).toBeCloseTo(TANK.points[0].y + TRAVEL.y, 6);
		} finally {
			rig.unmount();
		}
	});

	it('lands the part’s top-left corner on the 500 mm grid counted from the footprint’s corner while the grid is shown', async () => {
		const rig = await selectRig();
		try {
			useWorkspaceStore(rig.pinia).gridVisible = true;
			await settle();
			drag(rig, PRESS, { x: PRESS.x + TRAVEL.x, y: PRESS.y + TRAVEL.y });
			await settle();

			// (1040, 660) from the grid origin (-190, -350) in 500 mm steps: x → 810, y → 650.
			const corner = (await rig.document()).shape?.details[0]?.outline.points[0];
			expect(corner?.x).toBeCloseTo(FOOTPRINT_MIN.x + 1000, 6);
			expect(corner?.y).toBeCloseTo(FOOTPRINT_MIN.y + 1000, 6);
		} finally {
			rig.unmount();
		}
	});

	it('draws the grid above the stage, from the footprint’s corner, at the designer’s own step', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			expect(rig.wrapper.find('.rp-canvas-grid').exists()).toBe(false);
			useWorkspaceStore(rig.pinia).gridVisible = true;
			await settle();

			const grid = rig.wrapper.get('.rp-canvas-grid').element as HTMLElement;
			const corner = rig.at(FOOTPRINT_MIN);
			expect(grid.style.backgroundPosition).toBe(`${corner.x}px ${corner.y}px`);
			expect(grid.style.backgroundSize).toBe('50px 50px');
			const stage = rig.canvasEl.querySelector('.konvajs-content') as Element;
			expect(stage.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		} finally {
			rig.unmount();
		}
	});
});

describe('object snapping in the mounted designer', () => {
	/** The tank's top-left corner, and a drop 42 mm from it — inside the tolerance. */
	const CORNER = TANK.points[0];
	const DROP = { x: CORNER.x + 30, y: CORNER.y + 30 };

	it.each([
		[true, CORNER],
		[false, DROP],
	])('with Snap %s, an anchor dropped beside a corner lands at %o', async (enabled, expected) => {
		const rig = await selectRig();
		try {
			useEditorStore(rig.pinia).snappingEnabled = enabled;
			drag(rig, { x: 0, y: 0 }, DROP);
			await settle();

			const anchor = (await rig.document()).shape?.anchor;
			expect(anchor?.x).toBeCloseTo(expected.x, 6);
			expect(anchor?.y).toBeCloseTo(expected.y, 6);
		} finally {
			rig.unmount();
		}
	});

	it('draws the guide a trace would land on while the pointer hovers', async () => {
		const rig = await designerRig({ shape: toiletShape() });
		try {
			rig.toolbarButton(t('en', 'designer.toolbar.trace-detail')).click();
			await settle();
			click(rig, { x: 1000, y: 1000 });
			// 30 mm below the tank's top edge, far to its right: only the y alignment is in reach.
			move(rig, { x: 1500, y: CORNER.y + 30 });
			await settle();

			expect(rig.stage.find('.snap-guide').length).toBeGreaterThan(0);
		} finally {
			rig.unmount();
		}
	});
});
