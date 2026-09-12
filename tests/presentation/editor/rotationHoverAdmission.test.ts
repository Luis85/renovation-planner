import { expect, it, vi } from 'vitest';
import { SelectTool, type SelectToolDeps } from '../../../src/presentation/editor/tools/select-tool';
import { rotationHandleGeometry, type RotationShape } from '../../../src/presentation/editor/elements/objectRotation';
import { expectDefined } from '../../helpers/domain';
import { pointerAt, toolContext } from '../../helpers/tool-context';

const shape: RotationShape = { id: 'element-a', kind: 'object', points: [{ x: 100, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 400 }, { x: 100, y: 400 }] };
function setup(overrides: Partial<SelectToolDeps> = {}, scale = 1) {
	const context = toolContext({ worldPerScreenPixel: scale }).context, control = expectDefined(rotationHandleGeometry(shape, scale), 'control');
	const requestRotation = vi.fn<NonNullable<SelectToolDeps['requestRotation']>>(), commitRotation = vi.fn<NonNullable<SelectToolDeps['commitRotation']>>();
	const tool = new SelectTool({ spatialObjects: () => [], rotationDisplayTarget: () => shape, rotationTarget: () => shape, rotationControls: () => [control],
		requestRotation, commitRotation, createMoveGesture: vi.fn<SelectToolDeps['createMoveGesture']>(), reportRejected: vi.fn<SelectToolDeps['reportRejected']>(), reportInvalidInput: vi.fn<SelectToolDeps['reportInvalidInput']>(), ...overrides });
	tool.activate(context); return { context, control, tool, requestRotation, commitRotation };
}

it('preserves actual member IDs when the selected group descriptor owns the pressed arrow', () => {
	const group = { ...shape, id: 'group-a', kind: 'group' as const }, expandSelection = vi.fn<NonNullable<SelectToolDeps['expandSelection']>>().mockReturnValue(['unexpected']);
	const r = setup({ rotationDisplayTarget: () => group, rotationTarget: () => group, expandSelection });
	r.context.selection.select(['element-a' as never, 'element-b' as never]);
	r.tool.pointerDown(pointerAt(r.control.handle.x, r.control.handle.y)); r.tool.pointerUp(pointerAt(r.control.handle.x, r.control.handle.y));
	expect(r.context.selection.selectedIds).toEqual(['element-a', 'element-b']); expect(expandSelection).not.toHaveBeenCalled();
	expect(r.requestRotation).toHaveBeenCalledExactlyOnceWith(group.id); expect(r.commitRotation).not.toHaveBeenCalled();
});

it('refuses a stale singleton affordance over a multi-selection instead of collapsing its members', () => {
	const r = setup({ rotationTarget: () => null }); r.context.selection.select(['element-a' as never, 'element-b' as never]);
	r.tool.pointerDown(pointerAt(r.control.handle.x, r.control.handle.y)); r.tool.pointerUp(pointerAt(r.control.handle.x, r.control.handle.y));
	expect(r.context.selection.selectedIds).toEqual(['element-a', 'element-b']); expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled();
});

it('reacquires the selected descriptor after expansion and refuses a replacement target', () => {
	let expanded = false;
	const r = setup({ expandSelection: () => { expanded = true; return [shape.id]; }, rotationTarget: () => expanded ? { ...shape, id: 'replacement' } : null });
	r.tool.pointerDown(pointerAt(r.control.handle.x, r.control.handle.y)); r.tool.pointerUp(pointerAt(r.control.handle.x, r.control.handle.y));
	expect(r.context.selection.selectedIds).toEqual([shape.id]); expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.tool.hasDraft()).toBe(false);
});

it('falls back to selecting the hovered entity when no expansion port exists, without rotating an unavailable target', () => {
	const r = setup({ rotationTarget: undefined });
	r.tool.pointerDown(pointerAt(r.control.handle.x, r.control.handle.y)); r.tool.pointerUp(pointerAt(r.control.handle.x, r.control.handle.y));
	expect(r.context.selection.selectedIds).toEqual([shape.id]); expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled();
});

it('keeps the edge-to-arrow approach hover-only and clears it when its target disappears or Alt is held', () => {
	let current: RotationShape | null = shape;
	const r = setup({ rotationDisplayTarget: () => current }, 50);
	const point = { x: r.control.anchor.x + (r.control.handle.x - r.control.anchor.x) * 0.15, y: r.control.anchor.y + (r.control.handle.y - r.control.anchor.y) * 0.15 };
	r.tool.pointerMove(pointerAt(point.x, point.y)); expect(r.context.renderState.rotationHoverId).toBe(shape.id); expect(r.context.renderState.hoveredTargetKind).toBeNull();
	r.tool.pointerDown(pointerAt(point.x, point.y)); r.tool.pointerUp(pointerAt(point.x, point.y)); expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.context.selection.selectedIds).toEqual([]);
	current = null; r.tool.pointerMove(pointerAt(point.x, point.y)); expect(r.context.renderState.rotationHoverId).toBeNull();
	current = shape; const alt = pointerAt(point.x, point.y); r.tool.pointerMove({ ...alt, modifiers: { ...alt.modifiers, alt: true } }); expect(r.context.renderState.rotationHoverId).toBeNull();
});

it('neither offers nor starts rotation while the "select multiple" mode is on, since a touch user has no Alt', () => {
	const r = setup({ multiSelectionMode: () => true }); r.context.selection.select([shape.id as never]);
	const at = pointerAt(r.control.handle.x, r.control.handle.y);
	r.tool.pointerMove(at); expect(r.context.renderState.rotationHoverSuppressed).toBe(true); expect(r.context.renderState.hoveredTargetKind).not.toBe('rotation');
	r.tool.pointerDown(at); r.tool.pointerUp(at);
	expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled(); expect(r.context.selection.selectedIds).toEqual([shape.id]);
});
