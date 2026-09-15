import { expect, it, vi } from 'vitest';
import { SelectTool, type SelectToolDeps } from '../../../src/presentation/editor/tools/select-tool';
import { rotationHandleGeometry, type RotationShape } from '../../../src/presentation/editor/elements/objectRotation';
import { expectDefined } from '../../helpers/domain';
import { pointerAt, toolContext } from '../../helpers/tool-context';

const shape: RotationShape = { id: 'element-a', kind: 'object', points: [{ x: 100, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 400 }, { x: 100, y: 400 }] };
function setup(overrides: Partial<SelectToolDeps> = {}, scale = 1) {
	const context = toolContext({ worldPerScreenPixel: scale }).context, control = expectDefined(rotationHandleGeometry(shape, scale), 'control');
	const requestRotation = vi.fn<NonNullable<SelectToolDeps['requestRotation']>>(), commitRotation = vi.fn<NonNullable<SelectToolDeps['commitRotation']>>();
	const tool = new SelectTool({ spatialObjects: () => [], rotationTarget: () => shape, rotationControls: () => [control],
		requestRotation, commitRotation, createMoveGesture: vi.fn<SelectToolDeps['createMoveGesture']>(), reportRejected: vi.fn<SelectToolDeps['reportRejected']>(), reportInvalidInput: vi.fn<SelectToolDeps['reportInvalidInput']>(), ...overrides });
	tool.activate(context); return { context, control, tool, requestRotation, commitRotation };
}

it('preserves actual member IDs when the selected group descriptor owns the pressed arrow', () => {
	const group = { ...shape, id: 'group-a', kind: 'group' as const };
	const r = setup({ rotationTarget: () => group });
	r.context.selection.select(['element-a' as never, 'element-b' as never]);
	r.tool.pointerDown(pointerAt(r.control.handle.x, r.control.handle.y)); r.tool.pointerUp(pointerAt(r.control.handle.x, r.control.handle.y));
	expect(r.context.selection.selectedIds).toEqual(['element-a', 'element-b']);
	expect(r.requestRotation).toHaveBeenCalledExactlyOnceWith(group.id); expect(r.commitRotation).not.toHaveBeenCalled();
});

it('offers no rotation where there is no selected target, however near the pointer is to a stale control', () => {
	const r = setup({ rotationTarget: () => null });
	const at = pointerAt(r.control.handle.x, r.control.handle.y);
	r.tool.pointerMove(at); expect(r.context.renderState.hoveredTargetKind).not.toBe('rotation');
	r.tool.pointerDown(at); r.tool.pointerUp(at);
	expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled(); expect(r.tool.hasDraft()).toBe(false);
});

it('does not edge-scroll a rotation drag, whose angle turns about the shape rather than extending anything', () => {
	const r = setup(); r.context.selection.select([shape.id as never]);
	r.tool.pointerDown(pointerAt(r.control.handle.x, r.control.handle.y));
	expect(r.tool.hasDraft()).toBe(true); expect(r.tool.tracksPointer()).toBe(false);
});

it('neither offers nor starts rotation while the "select multiple" mode is on, since a touch user has no Alt', () => {
	const r = setup({ multiSelectionMode: () => true }); r.context.selection.select([shape.id as never]);
	const at = pointerAt(r.control.handle.x, r.control.handle.y);
	r.tool.pointerMove(at); expect(r.context.renderState.rotationHoverSuppressed).toBe(true); expect(r.context.renderState.hoveredTargetKind).not.toBe('rotation');
	r.tool.pointerDown(at); r.tool.pointerUp(at);
	expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled(); expect(r.context.selection.selectedIds).toEqual([shape.id]);
});
