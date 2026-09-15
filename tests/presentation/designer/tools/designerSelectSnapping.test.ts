/**
 * `DesignerSelectTool`'s snapping (asset designer snapping spec 2026-09-15, §2.1 and §4.4), driven directly over
 * the real snap service at one millimetre per pixel — 8 mm of tolerance. Two 100 mm squares on a 1000 x 600
 * footprint: A at x -350..-250, y -200..-100 and B at x 150..250, y 50..150, so every landing below is
 * arithmetic a reader can redo.
 */
import { describe, expect, it } from 'vitest';
import type { CurvedPolygon } from '../../../../src/core/geometry/CurvedPolygon';
import { rect } from '../../../../src/domain/asset/presets/presetGeometry';
import { designerSnapCandidates } from '../../../../src/presentation/designer/selection/snapCandidates';
import { editableShape } from '../../../helpers/assetShapes';
import { selectToolRig, type SelectToolRig } from '../../../helpers/designerSelection';
import { flushGesture, pointerAt, shiftPointerAt } from '../../../helpers/tool-context';

const A = rect(100, 100, -300, -150);
const B = rect(100, 100, 200, 100);
const SHAPE = editableShape({
	details: [
		{ id: 'detail-1', name: 'rectangle', outline: A, line: 'solid', pending: false },
		{ id: 'detail-2', name: 'rectangle', outline: B, line: 'solid', pending: false },
	],
});
const A_SELECTED = { kind: 'detail', id: 'detail-1' } as const;

const shifted = (outline: CurvedPolygon, dx: number, dy: number) => outline.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
const written = (rig: SelectToolRig, id: string) => rig.written[0]?.shape.details.find((detail) => detail.id === id)?.outline.points;

describe('moving a part', () => {
	it('lines a moved part up with a neighbour’s edge, commits what it previewed, and clears the guide at release', async () => {
		const rig = selectToolRig({ shape: SHAPE });
		rig.tool.activate(rig.harness.context);

		// B's left edge travels to x = -347, 3 mm from A's left edge at -350.
		rig.tool.pointerDown(pointerAt(200, 100));
		rig.tool.pointerMove(pointerAt(-297, 100));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(pointerAt(-297, 100));
		await flushGesture();

		expect(written(rig, 'detail-2')).toEqual(shifted(B, -500, 0));
		expect(midDrag).toHaveLength(1);
		expect([midDrag[0]?.start.x, midDrag[0]?.end.x]).toEqual([-350, -350]);
		expect(rig.previews.filter((preview) => preview !== null).at(-1)).toEqual(rig.written[0]?.shape);
		expect(rig.harness.context.renderState.snapGuides).toEqual([]);
	});

	it('lands a moved part’s top-left corner on a supplied grid, with no guide for it', async () => {
		const rig = selectToolRig({
			shape: SHAPE,
			context: {
				snapCandidates: (exclude) => ({ ...designerSnapCandidates(SHAPE, exclude ?? []), grid: { step: 50, origin: { x: -500, y: -300 } } }),
			},
		});
		rig.tool.activate(rig.harness.context);

		// Raw travel (37, 12) puts B's corner at (187, 62); the grid from (-500, -300) takes it to (200, 50).
		rig.tool.pointerDown(pointerAt(200, 100));
		rig.tool.pointerMove(pointerAt(237, 112));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(pointerAt(237, 112));
		await flushGesture();

		expect(written(rig, 'detail-2')).toEqual(shifted(B, 50, 0));
		expect(midDrag).toEqual([]);
	});

	it('clears its guides when the drag is cancelled, and when the tool is switched away', () => {
		const rig = selectToolRig({ shape: SHAPE });
		const context = rig.harness.context;
		rig.tool.activate(context);

		rig.tool.pointerDown(pointerAt(200, 100));
		rig.tool.pointerMove(pointerAt(-297, 100));
		expect(context.renderState.snapGuides).toHaveLength(1);
		rig.tool.cancel();
		expect(context.renderState.snapGuides).toEqual([]);

		rig.tool.pointerDown(pointerAt(200, 100));
		rig.tool.pointerMove(pointerAt(-297, 100));
		rig.tool.deactivate();
		expect(context.renderState.snapGuides).toEqual([]);
	});
});

describe('resizing from a box handle', () => {
	it('snaps a corner handle onto a neighbour’s corner', async () => {
		const rig = selectToolRig({ shape: SHAPE, selection: A_SELECTED });
		rig.tool.activate(rig.harness.context);

		// A's bottom-right handle (-250, -100) dropped 5 mm from B's top-left corner (150, 50).
		rig.tool.pointerDown(pointerAt(-250, -100));
		rig.tool.pointerMove(pointerAt(146, 47));
		rig.tool.pointerUp(pointerAt(146, 47));
		await flushGesture();

		expect(written(rig, 'detail-1')).toEqual([{ x: -350, y: -200 }, { x: 150, y: -200 }, { x: 150, y: 50 }, { x: -350, y: 50 }]);
	});

	it('snaps a side handle on the axis it moves, to alignments only, never onto an edge it passes', async () => {
		const rig = selectToolRig({ shape: SHAPE, selection: A_SELECTED });
		rig.tool.activate(rig.harness.context);

		// A's right-middle handle (-250, -150) dropped at (143, 60): 7 mm from B's left edge x = 150, and 7 mm from
		// that EDGE itself — an edge snap would draw a horizontal guide, an alignment draws a vertical one.
		rig.tool.pointerDown(pointerAt(-250, -150));
		rig.tool.pointerMove(pointerAt(143, 60));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(pointerAt(143, 60));
		await flushGesture();

		expect(written(rig, 'detail-1')).toEqual([{ x: -350, y: -200 }, { x: 150, y: -200 }, { x: 150, y: -100 }, { x: -350, y: -100 }]);
		expect(midDrag).toHaveLength(1);
		expect([midDrag[0]?.start.x, midDrag[0]?.end.x]).toEqual([150, 150]);
	});

	/**
	 * A COVERAGE pin for `snapBoxHandle`'s `alongX === false` arm (final review, F4) — every case above this
	 * one presses a corner or a right/left (`alongX === true`) side handle. A's bottom-middle handle
	 * (index 5, `boxHandlePoint`'s (mid.x, max.y)) is (-300, -100); its opposite (index 1, top-middle) is
	 * (-300, -200), sharing the handle's x, so this is the vertical side case. Dropped at (-300, 47): x
	 * unchanged (no candidate x — B's are 150/200/250 — is anywhere near it), y 3 mm from B's top edge at
	 * y = 50, which both of B's top corners share as an alignment. Passes today; it is not tautological
	 * because the `alongX ? … : { x: moved.x, y: result.point.y }` arm under test is what puts y = 50 (not
	 * the raw 47) into `to`, and the parallel `guides` filter is what keeps only the HORIZONTAL guide —
	 * reasoned rather than probed: swap either ternary's false branch for its true one and this drop no
	 * longer lands on B's edge, and the guide's axis flips.
	 */
	it('snaps a top/bottom side handle along y, the alongX === false arm, onto a neighbour’s alignment', async () => {
		const rig = selectToolRig({ shape: SHAPE, selection: A_SELECTED });
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(-300, -100));
		rig.tool.pointerMove(pointerAt(-300, 47));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(pointerAt(-300, 47));
		await flushGesture();

		expect(written(rig, 'detail-1')).toEqual([{ x: -350, y: -200 }, { x: -250, y: -200 }, { x: -250, y: 50 }, { x: -350, y: 50 }]);
		expect(midDrag).toHaveLength(1);
		expect([midDrag[0]?.start.y, midDrag[0]?.end.y]).toEqual([50, 50]);
	});

	/** Passes before this task too: it pins that proportional resize stays unsnapped (spec §2.5). */
	it('takes the raw point and draws no guide while Shift keeps proportions', async () => {
		const rig = selectToolRig({ shape: SHAPE, selection: A_SELECTED });
		rig.tool.activate(rig.harness.context);

		rig.tool.pointerDown(pointerAt(-250, -150));
		rig.tool.pointerMove(shiftPointerAt(143, 60));
		const midDrag = rig.harness.context.renderState.snapGuides;
		rig.tool.pointerUp(shiftPointerAt(143, 60));
		await flushGesture();

		expect(Math.max(...(written(rig, 'detail-1') ?? []).map((point) => point.x))).toBeCloseTo(143, 9);
		expect(midDrag).toEqual([]);
	});
});
