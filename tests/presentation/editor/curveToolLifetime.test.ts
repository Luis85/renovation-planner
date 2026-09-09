import { expect, it, vi } from 'vitest';
import { CurveTool } from '../../../src/presentation/editor/curves/CurveTool';
import { curveEdges, withCurve, type CurveTarget } from '../../../src/presentation/editor/curves/curveDraft';
import { pointerAt, toolContext } from '../../helpers/tool-context';

function setup(bulge = 0) {
	const state = { blocked: false, busy: false, target: { id: 'wall', name: 'Wall', kind: 'wall',
		geometry: { points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], bulges: [bulge, 0] } } as CurveTarget | null };
	const actions = { target: () => state.target, blocked: () => state.blocked, busy: () => state.busy,
		choose: vi.fn<(index: number) => void>(), stop: vi.fn<() => void>(), cancel: vi.fn<() => void>(), finish: vi.fn<() => void>(),
		set: vi.fn((index: number, value: number) => { if (state.target) state.target = withCurve(state.target, index, value); }) };
	const tool = new CurveTool(actions), { context } = toolContext();
	return { state, actions, tool, context };
}

it('does not admit a bend before activation, without a target, while paused, on secondary press or outside its handle', () => {
	const { state, actions, tool, context } = setup(), target = state.target, press = pointerAt(500, 0);
	tool.pointerDown(press); tool.activate(context);
	state.target = null; expect(tool.hasDraft()).toBe(false); tool.pointerDown(press);
	state.target = target; state.blocked = true; tool.pointerDown(press);
	state.blocked = false; tool.pointerDown({ ...press, button: 'secondary' }); tool.pointerDown(pointerAt(900, 500));
	tool.pointerMove(pointerAt(500, -100)); tool.pointerUp(pointerAt(500, -100));
	expect(actions.choose).not.toHaveBeenCalled(); expect(actions.set).not.toHaveBeenCalled();
	expect(tool.hasDraft()).toBe(true); expect(tool.canDeactivate()).toBe(true);
	state.busy = true; expect(tool.canDeactivate()).toBe(false);
});

it('treats a handle click as edge choice and waits for the primary release before permitting finish', () => {
	const { tool, context, actions } = setup(); tool.activate(context);
	tool.pointerDown(pointerAt(500, 0)); tool.pointerMove(pointerAt(500.25, -0.25));
	tool.pointerUp({ ...pointerAt(500, -300), button: 'secondary' }); tool.finish();
	expect(actions.choose).toHaveBeenCalledWith(0); expect(actions.set).not.toHaveBeenCalled(); expect(actions.finish).not.toHaveBeenCalled();
	tool.pointerUp(pointerAt(500, 0)); tool.finish(); expect(actions.finish).toHaveBeenCalledTimes(1);
	expect(actions.set).not.toHaveBeenCalled(); tool.abandonGesture(); expect(actions.set).not.toHaveBeenCalled();
});

it('ignores invalid or paused pointer samples and restores the existing bend when its drag is interrupted or deactivated', () => {
	const { state, tool, context, actions } = setup(0.2); tool.activate(context);
	const target = state.target as CurveTarget, midpoint = curveEdges(target)[0].midpoint;
	tool.pointerDown(pointerAt(midpoint.x, midpoint.y));
	tool.pointerMove(pointerAt(Number.NaN, -200)); tool.pointerMove(pointerAt(500, Number.POSITIVE_INFINITY));
	state.blocked = true; tool.pointerMove(pointerAt(500, -200));
	expect(actions.set).not.toHaveBeenCalled(); state.blocked = false;
	tool.pointerMove(pointerAt(500, -200)); expect(state.target?.geometry.bulges?.[0]).toBeCloseTo(0.4);
	tool.abandonGesture(); expect(state.target?.geometry.bulges?.[0]).toBeCloseTo(0.2);
	expect(actions.cancel).not.toHaveBeenCalled(); expect(actions.stop).not.toHaveBeenCalled();
	tool.pointerDown(pointerAt(midpoint.x, midpoint.y)); tool.pointerMove(pointerAt(500, -250)); tool.deactivate();
	expect(state.target?.geometry.bulges?.[0]).toBeCloseTo(0.2); expect(actions.stop).toHaveBeenCalledTimes(1);
	actions.set.mockClear(); tool.pointerDown(pointerAt(midpoint.x, midpoint.y)); tool.pointerMove(pointerAt(500, -300));
	expect(actions.set).not.toHaveBeenCalled(); tool.cancel(); expect(actions.cancel).toHaveBeenCalledTimes(1);
});
