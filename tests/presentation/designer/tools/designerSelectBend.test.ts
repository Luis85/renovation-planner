/**
 * Bend edges in the designer's Select tool (asset designer symbols spec, Decision 10): the plan
 * editor's `CurveTool`, bound to ONE edge of the selected outline, previewing through the leaf's store
 * and committing a single conditional write on release.
 *
 * The tank's top edge is straight, 380 mm long, and its midpoint is where Bend edges draws its handle.
 * A bulge is twice the arc's depth over its chord, so a pointer 50 mm off the edge's middle, away from
 * the outline's inside, is a bulge of 100 / 380 — positive, which bows outward on this winding.
 */
import { describe, expect, it } from 'vitest';
import { flushGesture, pointerAt } from '../../../helpers/tool-context';
import { DESIGN_VERSION, detailOutline, selectToolRig, type SelectToolRig } from '../../../helpers/designerSelection';

const TANK = detailOutline('detail-1');
const TOP = { x: (TANK.points[0].x + TANK.points[1].x) / 2, y: TANK.points[0].y };
const CHORD = TANK.points[1].x - TANK.points[0].x;
const RISE = 50;

function bendRig(): SelectToolRig {
	const rig = selectToolRig({ selection: { kind: 'detail', id: 'detail-1' }, mode: 'bend' });
	rig.tool.activate(rig.harness.context);
	return rig;
}

describe('bending an edge', () => {
	it('writes one command bowing the pressed edge, every other edge left straight', async () => {
		const rig = bendRig();

		rig.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		// Escape asks this before it cancels, and edge scrolling asks the other.
		expect(rig.tool.hasDraft()).toBe(true);
		expect(rig.tool.tracksPointer()).toBe(true);
		rig.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		rig.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE));
		await flushGesture();

		expect(rig.harness.dispatched).toHaveLength(1);
		expect(rig.written[0]?.expected).toBe(DESIGN_VERSION);
		const outline = rig.written[0]?.shape.details[0]?.outline;
		expect(outline?.bulges?.[0]).toBeCloseTo((2 * RISE) / CHORD, 12);
		expect(outline?.bulges?.slice(1)).toEqual([0, 0, 0]);
		expect(outline?.points).toEqual(TANK.points);
		expect(rig.previews.at(-1)).toBeNull();
		expect(rig.tool.hasDraft()).toBe(false);
		expect(rig.tool.tracksPointer()).toBe(false);
	});

	it('writes nothing for a click on an edge midpoint that never moves', async () => {
		const rig = bendRig();

		rig.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		rig.tool.pointerUp(pointerAt(TOP.x, TOP.y));
		await flushGesture();

		expect(rig.written).toEqual([]);
		expect(rig.previews).toEqual([]);
		expect(rig.tool.hasDraft()).toBe(false);
	});

	it('writes nothing and clears the preview when Escape cancels a bend', async () => {
		const rig = bendRig();

		rig.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		rig.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		expect(rig.previews.at(-1)).not.toBeNull();
		rig.tool.cancel();
		rig.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE));
		await flushGesture();

		expect(rig.previews.at(-1)).toBeNull();
		expect(rig.tool.hasDraft()).toBe(false);
		expect(rig.written).toEqual([]);
	});

	it('writes nothing and clears the preview when a bend is interrupted, or the tool switched away', async () => {
		const interrupted = bendRig();
		interrupted.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		interrupted.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		interrupted.tool.abandonGesture();
		interrupted.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE));

		const switched = bendRig();
		switched.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		switched.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		switched.tool.deactivate();
		switched.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE));
		await flushGesture();

		expect(interrupted.previews.at(-1)).toBeNull();
		expect(interrupted.written).toEqual([]);
		expect(switched.previews.at(-1)).toBeNull();
		expect(switched.written).toEqual([]);
	});

	/** A bend whose release never arrived must not be committed by the release of a LATER press. */
	it('drops a bend left over from a secondary release when the next primary press lands', async () => {
		const rig = bendRig();

		rig.tool.pointerDown(pointerAt(TOP.x, TOP.y));
		rig.tool.pointerMove(pointerAt(TOP.x, TOP.y - RISE));
		rig.tool.pointerUp(pointerAt(TOP.x, TOP.y - RISE, 'secondary'));
		expect(rig.tool.hasDraft()).toBe(true);
		// Outside the clearance: a press on nothing.
		rig.tool.pointerDown(pointerAt(1000, 1000));
		expect(rig.tool.hasDraft()).toBe(false);
		rig.tool.pointerUp(pointerAt(1000, 1000));
		await flushGesture();

		expect(rig.written).toEqual([]);
		expect(rig.previews.at(-1)).toBeNull();
		// The leftover bend's curve drag went with it: a cancel now must not ask a bend that is gone.
		expect(() => rig.tool.cancel()).not.toThrow();
	});
});
