import { expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import { ok } from '../../../../src/core/result/Result';
import { pointerAt, toolContext, flushGesture } from '../../../helpers/tool-context';

function setup() {
	setActivePinia(createPinia());
	let allowed = true;
	const dispatch = vi.fn<() => Promise<ReturnType<typeof ok<'wrote'>>>>(() => Promise.resolve(ok('wrote')));
	const { context } = toolContext({ commandDispatcher: { run: dispatch } });
	const tool = new SelectTool({
		canMutateGeometry: () => allowed,
		spatialObjects: () => [{ id: 'room', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] }],
		createMoveGesture: () => ({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }),
		reportRejected: vi.fn<() => void>(), reportInvalidInput: vi.fn<() => void>(),
	});
	tool.activate(context);
	return { tool, context, dispatch, refuse: () => { allowed = false; } };
}

it.each(['move', 'up'] as const)('rechecks permission at pointer %s even without the registered perspective watcher', async phase => {
	const rig = setup();
	rig.tool.pointerDown(pointerAt(30, 30));
	rig.tool.pointerMove(pointerAt(50, 50));
	rig.refuse();
	if (phase === 'move') rig.tool.pointerMove(pointerAt(60, 60));
	else rig.tool.pointerUp(pointerAt(60, 60));
	expect(rig.tool.hasDraft()).toBe(false);
	expect(rig.context.renderState.previewPolygon).toBeNull();
	rig.tool.pointerUp(pointerAt(70, 70));
	await flushGesture();
	expect(rig.dispatch).not.toHaveBeenCalled();
});

it('does not cancel or erase the preview of an already dispatched write', async () => {
	const rig = setup();
	let finish!: () => void;
	rig.dispatch.mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve(ok('wrote')); }));
	rig.tool.pointerDown(pointerAt(30, 30));
	rig.tool.pointerUp(pointerAt(60, 60));
	const preview = rig.context.renderState.previewPolygon;
	expect(preview).not.toBeNull();
	rig.refuse();
	expect(rig.tool.cancelGeometryGesture()).toBe(false);
	rig.tool.pointerMove(pointerAt(80, 80));
	expect(rig.context.renderState.previewPolygon).toEqual(preview);
	expect(rig.dispatch).toHaveBeenCalledOnce();
	finish(); await flushGesture();
	expect(rig.context.renderState.previewPolygon).toBeNull();
});
