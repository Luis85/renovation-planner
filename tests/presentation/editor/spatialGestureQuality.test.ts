import { expect, it, vi } from 'vitest';
import { CurveTool } from '../../../src/presentation/editor/curves/CurveTool';
import { type CurveTarget } from '../../../src/presentation/editor/curves/curveDraft';
import { ElementMove } from '../../../src/presentation/editor/elements/ElementMove';
import { toolContext, pointerAt } from '../../helpers/tool-context';
import type { SpatialObjectCandidate } from '../../../src/presentation/editor/tools/select-tool';

function curveRig() {
	let target: CurveTarget | null = { id: 'room', name: 'Room', kind: 'room', geometry: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] } };
	let blocked = false, busy = false;
	const set = vi.fn(), choose = vi.fn(), stop = vi.fn(), cancel = vi.fn(), finish = vi.fn();
	const tool = new CurveTool({ target: () => target, blocked: () => blocked, busy: () => busy, set, choose, stop, cancel, finish });
	return { tool, set, choose, stop, cancel, finish, retire: () => { target = null; }, block: () => { blocked = true; }, save: () => { busy = true; } };
}

it('commits the latest curve pointer on primary release and reserves Finish for a completed gesture', () => {
	const r = curveRig(); r.tool.activate(toolContext({ worldPerScreenPixel: 2 }).context);
	r.tool.pointerDown(pointerAt(500, 0)); r.tool.finish(); expect(r.finish).not.toHaveBeenCalled();
	r.tool.pointerMove(pointerAt(500, -100)); expect(r.set).toHaveBeenLastCalledWith(0, 0.2);
	r.tool.pointerUp({ ...pointerAt(500, -200), button: 'secondary' }); r.tool.finish(); expect(r.finish).not.toHaveBeenCalled();
	r.tool.pointerUp(pointerAt(500, -250)); expect(r.set).toHaveBeenLastCalledWith(0, 0.5);
	r.tool.finish(); expect(r.finish).toHaveBeenCalledOnce(); expect(r.tool.hasDraft()).toBe(true);
	r.tool.deactivate(); expect(r.stop).toHaveBeenCalledOnce(); r.retire(); expect(r.tool.hasDraft()).toBe(false);
});

it('does not bend on a click or invalid pointer and restores the original bend on cancellation', () => {
	const r = curveRig(); r.tool.activate(toolContext().context);
	r.tool.pointerMove(pointerAt(500, -100)); r.tool.pointerDown(pointerAt(500, 0));
	r.tool.pointerMove(pointerAt(500, -1)); r.tool.pointerMove(pointerAt(Infinity, 0)); r.tool.pointerMove(pointerAt(0, NaN));
	r.tool.pointerUp(pointerAt(500, 0)); expect(r.set).not.toHaveBeenCalled();
	r.tool.pointerDown(pointerAt(500, 0)); r.tool.pointerMove(pointerAt(500, -100)); r.tool.cancel();
	expect(r.set.mock.calls).toEqual([[0, 0.2], [0, 0]]); expect(r.cancel).toHaveBeenCalledOnce();
	r.tool.pointerUp(pointerAt(500, -500)); expect(r.set).toHaveBeenCalledTimes(2);
});

it('admits curve handles only in the active writable task and keeps a pending save attached', () => {
	const r = curveRig(), down = pointerAt(500, 0);
	r.tool.pointerDown(down); r.tool.activate(toolContext().context);
	r.tool.pointerDown({ ...down, button: 'secondary' }); r.tool.pointerDown(pointerAt(500, 500)); expect(r.choose).not.toHaveBeenCalled();
	r.tool.pointerDown(down); expect(r.choose).toHaveBeenCalledWith(0); r.block();
	r.tool.pointerMove(pointerAt(500, -200)); r.tool.pointerUp(pointerAt(500, -200)); expect(r.set).not.toHaveBeenCalled();
	r.tool.pointerDown(down); expect(r.choose).toHaveBeenCalledOnce();
	expect(r.tool.canDeactivate()).toBe(true); r.save(); expect(r.tool.canDeactivate()).toBe(false);
	r.retire(); r.tool.pointerDown(down); expect(r.choose).toHaveBeenCalledOnce();
});

const arrow: SpatialObjectCandidate = { id: 'element-arrow', kind: 'arrow', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }] };
it.each(['wall', 'opening', 'room', 'blocked', 'shift', 'alt', 'unsupported', 'missing-vertex'] as const)('refuses %s element-move admission without changing preview or history', reason => {
	const moveElement = vi.fn(), previewElement = vi.fn(), move = new ElementMove({ moveElement, previewElement });
	const context = toolContext({ writesBlocked: reason === 'blocked' }).context, event = pointerAt(0, 0);
	const hit = reason === 'wall' || reason === 'opening' ? { ...arrow, kind: reason } : reason === 'room' ? { ...arrow, kind: undefined } : reason === 'unsupported' ? { ...arrow, kind: 'object' as const } : arrow;
	move.start(context, { ...event, modifiers: { ...event.modifiers, shift: reason === 'shift', alt: reason === 'alt' } }, hit, reason === 'missing-vertex' ? 9 : reason === 'unsupported' ? 0 : undefined);
	move.move(pointerAt(500, 500)); move.finish(context, pointerAt(500, 500));
	expect(move.active).toBe(false); expect(moveElement).not.toHaveBeenCalled(); expect(previewElement).not.toHaveBeenCalled();
});

it('retains all untouched Arrow vertices while moving its first endpoint and refuses a collapsed endpoint', () => {
	const moveElement = vi.fn(), previewElement = vi.fn(), move = new ElementMove({ moveElement, previewElement }), context = toolContext({ snapPoint: point => point }).context;
	move.start(context, pointerAt(0, 0), arrow, 0); move.move(pointerAt(-200, 0));
	expect(previewElement).toHaveBeenLastCalledWith('element-arrow', [{ x: -200, y: 0 }, ...arrow.points.slice(1)]);
	move.finish(context, pointerAt(-250, 0)); expect(moveElement).toHaveBeenCalledWith('element-arrow', [{ x: -250, y: 0 }, ...arrow.points.slice(1)], expect.objectContaining({ points: arrow.points }));
	moveElement.mockClear(); move.start(context, pointerAt(0, 0), arrow, 0); move.finish(context, pointerAt(1000, 0));
	expect(moveElement).not.toHaveBeenCalled(); expect(move.active).toBe(false); expect(previewElement).toHaveBeenLastCalledWith(null);
});

it('cancels an element drag without a commit and refuses a release after writes become blocked', () => {
	const moveElement = vi.fn(), previewElement = vi.fn(), move = new ElementMove({ moveElement, previewElement }), context = toolContext().context;
	const unwired = new ElementMove({}); unwired.start(context, pointerAt(0, 0), arrow); expect(unwired.active).toBe(false);
	move.start(context, pointerAt(0, 0), arrow); move.move(pointerAt(100, 200)); move.cancel(); move.finish(context, pointerAt(100, 200));
	expect(moveElement).not.toHaveBeenCalled(); expect(previewElement).toHaveBeenLastCalledWith(null);
	move.start(context, pointerAt(0, 0), arrow); move.finish(toolContext({ writesBlocked: true }).context, pointerAt(100, 200));
	expect(move.active).toBe(false); expect(moveElement).not.toHaveBeenCalled();
});
