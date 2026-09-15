/**
 * `DesignerSelectTool` driven directly (asset designer symbols spec, Decision 10): Transform and Edit
 * points against the real hit order, drag arithmetic and snap service, at one world millimetre per
 * pixel.
 *
 * The mounted half — the toolbar reaching the tool, the canvas drawing its preview, a real write and
 * its undo — is `designerSelection.test.ts`. What only this file can reach is what a real pointer
 * stream cannot discriminate: a secondary release, a gesture cancelled or abandoned mid-drag, a tool
 * switched away mid-drag, and a write settling after a LATER gesture has drawn its own preview.
 */
import { describe, expect, it } from 'vitest';
import type { AppError } from '../../../../src/core/errors/AppError';
import type { Point } from '../../../../src/core/geometry/Point';
import { ok } from '../../../../src/core/result/Result';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { facingTip } from '../../../../src/presentation/designer/layers/anchorLayer';
import { flushGesture, pointerAt, shiftPointerAt } from '../../../helpers/tool-context';
import {
	DESIGN_VERSION,
	TOILET,
	detailOutline,
	justInsideBottom,
	selectToolRig,
} from '../../../helpers/designerSelection';

const TANK = detailOutline('detail-1');
const BOWL = detailOutline('detail-2');
const IN_BOWL = justInsideBottom(BOWL);
const TANK_SELECTED = { kind: 'detail', id: 'detail-1' } as const;
const TL = TANK.points[0];
const BR = TANK.points[2];

/** A point of the tank scaled ×2 about its top-left corner — where the bottom-right handle is dragged to. */
const doubled = (point: Point): Point => ({ x: TL.x + 2 * (point.x - TL.x), y: TL.y + 2 * (point.y - TL.y) });

/**
 * For the press-off-the-feature cases: the press lands 3 mm left of the feature it grabs, and the
 * pointer is released 10 mm left of footprint vertex 2 — beyond the 8 mm snap tolerance — so the
 * FEATURE, carried by the same travel, arrives 7 mm from that vertex and inside it. Snapping the raw
 * pointer instead would snap nothing, and the feature would stop 7 mm short.
 */
const FOOTPRINT_CORNER = TOILET.footprint.points[2];
const PRESS_OFFSET = { x: -3, y: 0 };
const RELEASE_NEAR_CORNER = { x: FOOTPRINT_CORNER.x - 10, y: FOOTPRINT_CORNER.y };

const REFUSAL: DispatchResult = {
	ok: false,
	error: { category: 'Persistence', code: 'vault.unexpected-failure', message: 'x' } as AppError,
};

describe('selecting', () => {
	it('selects the detail under a click and dispatches nothing', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x, IN_BOWL.y));
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'detail', id: 'detail-2' }]);
		expect(rig.harness.dispatched).toHaveLength(0);
		expect(rig.written).toEqual([]);
	});

	it('clears the selection for a click on nothing, and starts no drag', () => {
		const rig = selectToolRig({ selection: TANK_SELECTED });
		rig.tool.activate(rig.harness.context);

		// Outside the clearance, which reaches x = 390 and y = 950.
		rig.tool.pointerDown(pointerAt(1000, 1000));

		expect(rig.selected).toEqual([null]);
		expect(rig.tool.hasDraft()).toBe(false);
	});

	it('does nothing before activation, after deactivation, or on an asset with no shape', () => {
		const rig = selectToolRig();
		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.activate(rig.harness.context);
		rig.tool.deactivate();
		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		const shapeless = selectToolRig({ shape: null });
		shapeless.tool.activate(shapeless.harness.context);
		shapeless.tool.pointerDown(pointerAt(0, 0));

		expect(rig.selected).toEqual([]);
		expect(shapeless.selected).toEqual([]);
		expect(shapeless.tool.hasDraft()).toBe(false);
	});

	it('does nothing for a secondary press', () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y, 'secondary'));

		expect(rig.selected).toEqual([]);
		expect(rig.tool.hasDraft()).toBe(false);
	});
});

describe('moving a part', () => {
	it('moves a dragged detail in one write, conditional on the version the press read', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 50, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.harness.dispatched).toHaveLength(1);
		expect(rig.written).toHaveLength(1);
		expect(rig.written[0]?.expected).toBe(DESIGN_VERSION);
		const bowl = rig.written[0]?.shape.details.find((detail) => detail.id === 'detail-2')?.outline;
		expect(bowl?.points).toEqual(BOWL.points.map((point) => ({ x: point.x + 100, y: point.y })));
		expect(bowl?.bulges).toEqual(BOWL.bulges);
		// Previewed while it ran — the release point too, before it was committed (ruling B7) — and the
		// preview cleared only once the write had settled.
		expect(rig.previews).toHaveLength(4);
		expect(rig.previews[1]).not.toBeNull();
		expect(rig.previews[3]).toBeNull();
	});

	/** `CurveTool.pointerUp`'s rule: the release point is previewed before it is committed, so the canvas shows what is written. */
	it('previews the release point before committing it', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 50, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.written).toHaveLength(1);
		expect(rig.previews.filter((preview) => preview !== null).at(-1)).toEqual(rig.written[0]?.shape);
		expect(rig.previews.at(-1)).toBeNull();
	});

	it('writes nothing, and previews nothing, for a press that never travels past the click epsilon', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 3, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 3, IN_BOWL.y));
		await flushGesture();

		expect(rig.written).toEqual([]);
		expect(rig.previews).toEqual([]);
	});

	it('moves the anchor onto a detail vertex within the snap tolerance', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);
		const vertex = BOWL.points[1];

		rig.tool.pointerDown(pointerAt(TOILET.anchor.x, TOILET.anchor.y));
		rig.tool.pointerMove(pointerAt(vertex.x - 2, vertex.y - 2));
		rig.tool.pointerUp(pointerAt(vertex.x - 2, vertex.y - 2));
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'anchor' }]);
		expect(rig.written[0]?.shape.anchor).toEqual(vertex);
	});

	it('snaps the moved anchor, not the pointer, for a press beside the anchor', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);
		const press = { x: TOILET.anchor.x + PRESS_OFFSET.x, y: TOILET.anchor.y + PRESS_OFFSET.y };

		rig.tool.pointerDown(pointerAt(press.x, press.y));
		rig.tool.pointerMove(pointerAt(RELEASE_NEAR_CORNER.x, RELEASE_NEAR_CORNER.y));
		rig.tool.pointerUp(pointerAt(RELEASE_NEAR_CORNER.x, RELEASE_NEAR_CORNER.y));
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'anchor' }]);
		expect(rig.written[0]?.shape.anchor).toEqual(FOOTPRINT_CORNER);
	});

	it('turns the facing by the drag’s bearing from the anchor, onto the step while shift is held', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);
		const tip = facingTip(TOILET, 1);

		rig.tool.pointerDown(pointerAt(tip.x, tip.y));
		rig.tool.pointerMove(shiftPointerAt(100, 10));
		rig.tool.pointerUp(shiftPointerAt(100, 10));
		await flushGesture();

		expect(rig.selected).toEqual([{ kind: 'facing' }]);
		// atan2(10, 100) is 5.7 degrees, nearer the 0 step than the 15 degree one.
		expect(rig.written[0]?.shape.facing).toBe(0);
	});
});

describe('a selected outline', () => {
	it('in Transform, resizes from the corner handle dragged, about the opposite corner', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED });
		rig.tool.activate(rig.harness.context);
		const to = doubled(BR);

		rig.tool.pointerDown(pointerAt(BR.x, BR.y));
		rig.tool.pointerMove(pointerAt(to.x, to.y));
		rig.tool.pointerUp(pointerAt(to.x, to.y));
		await flushGesture();

		// A handle press belongs to the selection it is drawn around and selects nothing new.
		expect(rig.selected).toEqual([]);
		expect(rig.written[0]?.shape.details[0]?.outline.points).toEqual(TANK.points.map(doubled));
	});

	it('refuses a resize that crosses the opposite edge at release, reports it, and writes nothing', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED });
		rig.tool.activate(rig.harness.context);
		const valid = doubled(BR);
		const crossed = { x: TL.x - 100, y: valid.y };

		rig.tool.pointerDown(pointerAt(BR.x, BR.y));
		rig.tool.pointerMove(pointerAt(valid.x, valid.y));
		rig.tool.pointerMove(pointerAt(crossed.x, crossed.y));
		rig.tool.pointerUp(pointerAt(crossed.x, crossed.y));
		await flushGesture();

		// The crossing move kept the last valid preview rather than drawing nothing; the release cleared it.
		expect(rig.previews).toHaveLength(2);
		expect(rig.previews[0]).not.toBeNull();
		expect(rig.previews[1]).toBeNull();
		expect(rig.invalid.map((error) => error.code)).toEqual(['asset.invalid-scale']);
		expect(rig.written).toEqual([]);
		expect(rig.harness.dispatched).toHaveLength(0);
	});

	it('in Edit points, snaps a dragged vertex onto a footprint vertex', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED, mode: 'points' });
		rig.tool.activate(rig.harness.context);
		const corner = TOILET.footprint.points[2];

		rig.tool.pointerDown(pointerAt(BR.x, BR.y));
		rig.tool.pointerMove(pointerAt(corner.x - 4, corner.y - 3));
		rig.tool.pointerUp(pointerAt(corner.x - 4, corner.y - 3));
		await flushGesture();

		expect(rig.written[0]?.shape.details[0]?.outline.points).toEqual([TANK.points[0], TANK.points[1], corner, TANK.points[3]]);
	});

	it('in Edit points, snaps the moved vertex, not the pointer, for a press beside the vertex', async () => {
		const rig = selectToolRig({ selection: TANK_SELECTED, mode: 'points' });
		rig.tool.activate(rig.harness.context);
		const press = { x: BR.x + PRESS_OFFSET.x, y: BR.y + PRESS_OFFSET.y };

		rig.tool.pointerDown(pointerAt(press.x, press.y));
		rig.tool.pointerMove(pointerAt(RELEASE_NEAR_CORNER.x, RELEASE_NEAR_CORNER.y));
		rig.tool.pointerUp(pointerAt(RELEASE_NEAR_CORNER.x, RELEASE_NEAR_CORNER.y));
		await flushGesture();

		expect(rig.written[0]?.shape.details[0]?.outline.points).toEqual([TANK.points[0], TANK.points[1], FOOTPRINT_CORNER, TANK.points[3]]);
	});
});

describe('an interrupted gesture', () => {
	it('drops the drag and its preview on Escape and on an interruption, writing nothing', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		// Escape asks this before it cancels, so a drag in flight is abandoned before a selection is cleared.
		expect(rig.tool.hasDraft()).toBe(true);
		rig.tool.cancel();
		expect(rig.tool.hasDraft()).toBe(false);
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.abandonGesture();
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.previews.at(-1)).toBeNull();
		expect(rig.written).toEqual([]);
	});

	it('clears its preview when it is switched away mid-drag', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.deactivate();
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.previews.at(-1)).toBeNull();
		expect(rig.tool.hasDraft()).toBe(false);
		expect(rig.written).toEqual([]);
	});

	it('commits nothing for a drag whose release names another button', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y, 'secondary'));
		await flushGesture();

		expect(rig.written).toEqual([]);
		expect(rig.tool.hasDraft()).toBe(true);
	});

	it('drops a drag left over from a secondary release when the next primary press lands', async () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y, 'secondary'));
		// Outside the clearance: a press on nothing, whose release must not commit the older drag.
		rig.tool.pointerDown(pointerAt(1000, 1000));
		expect(rig.tool.hasDraft()).toBe(false);
		rig.tool.pointerUp(pointerAt(1000, 1000));
		await flushGesture();

		expect(rig.written).toEqual([]);
		expect(rig.invalid).toEqual([]);
	});

	it('follows the pointer only once a press has travelled past the click epsilon', () => {
		const rig = selectToolRig();
		rig.tool.activate(rig.harness.context);

		// A hover and a stray release with no press behind them hold nothing and draw nothing.
		rig.tool.pointerMove(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x, IN_BOWL.y));
		expect(rig.previews).toEqual([]);
		expect(rig.tool.tracksPointer()).toBe(false);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		expect(rig.tool.tracksPointer()).toBe(false);
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		expect(rig.tool.tracksPointer()).toBe(true);
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		expect(rig.tool.tracksPointer()).toBe(false);
	});
});

describe('a write the vault refuses', () => {
	it('is reported, and the preview still cleared', async () => {
		const rig = selectToolRig({ context: { commandDispatcher: { run: () => Promise.resolve(REFUSAL) } } });
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		await flushGesture();

		expect(rig.rejected.map((error) => error.code)).toEqual(['vault.unexpected-failure']);
		expect(rig.previews.at(-1)).toBeNull();
	});

	/**
	 * The generation guard: an earlier gesture's write settling must not wipe the preview a LATER
	 * gesture has drawn. Remove the guard and the last preview recorded here is `null`.
	 */
	it('leaves a later gesture’s preview standing when an earlier write settles under it', async () => {
		let settle!: (result: DispatchResult) => void;
		const rig = selectToolRig({
			context: {
				commandDispatcher: {
					run: () =>
						new Promise<DispatchResult>((resolve) => {
							settle = resolve;
						}),
				},
			},
		});
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerUp(pointerAt(IN_BOWL.x + 100, IN_BOWL.y));
		rig.tool.pointerDown(pointerAt(IN_BOWL.x, IN_BOWL.y));
		rig.tool.pointerMove(pointerAt(IN_BOWL.x + 50, IN_BOWL.y));
		settle(ok('wrote'));
		await flushGesture();

		expect(rig.previews.at(-1)).not.toBeNull();
	});
});
