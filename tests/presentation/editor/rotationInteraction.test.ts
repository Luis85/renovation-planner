import { describe, expect, it, vi } from 'vitest';
import { ElementRotation, type RotationGestureDeps } from '../../../src/presentation/editor/elements/ElementRotation';
import { rotationHandleGeometry, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { layoutRotationControls, rotationControlApproachContains, rotationControlContains } from '../../../src/presentation/editor/elements/rotationControl';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { screenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import { pointerAt, toolContext } from '../../helpers/tool-context';
import { expectDefined } from '../../helpers/domain';
import { SelectTool, type SelectToolDeps } from '../../../src/presentation/editor/tools/select-tool';

const shape = { id: 'object', kind: 'object' as const, points: [{ x: 100, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 400 }, { x: 100, y: 400 }] };
it.each([0.2, 1, 4])('places bounded edge arrows with separate 44px rectangles at scale %s', scale => {
	const pivot = { x: 300, y: 300 }, controls = layoutRotationControls(shape, pivot, scale);
	expect(controls.length).toBeGreaterThan(0); expect(controls.length).toBeLessThanOrEqual(4);
	for (const [index, control] of controls.entries()) {
		expect(control.widthPx).toBe(44); expect((control.bounds.max.y - control.bounds.min.y) / scale).toBeCloseTo(44);
		expect(Math.hypot(control.handle.x - control.anchor.x, control.handle.y - control.anchor.y) / scale).toBeLessThanOrEqual(36);
		for (const other of controls.slice(index + 1)) expect(control.bounds.max.x < other.bounds.min.x || other.bounds.max.x < control.bounds.min.x || control.bounds.max.y < other.bounds.min.y || other.bounds.max.y < control.bounds.min.y).toBe(true);
	}
});
it('keeps a tiny item’s approach corridor hover-only, without turning it into an oversized click target', () => {
	const control = expectDefined(layoutRotationControls(shape, { x: 300, y: 300 }, 50)[0], 'tiny item control');
	const point = { x: control.anchor.x + (control.handle.x - control.anchor.x) * 0.15, y: control.anchor.y + (control.handle.y - control.anchor.y) * 0.15 };
	expect(rotationControlApproachContains(control, point, 50)).toBe(true);
	expect(rotationControlContains(control.bounds, point)).toBe(false);
});
it('uses the expansion port before taking a fresh target and refuses a retired selection', () => {
	const context = toolContext().context, control = expectDefined(rotationHandleGeometry(shape, 1), 'control');
	const expandSelection = vi.fn<(id: string, deep: boolean) => readonly string[]>().mockReturnValue([]), requestRotation = vi.fn<NonNullable<RotationGestureDeps['requestRotation']>>();
	const tool = new SelectTool({ spatialObjects: () => [shape], expandSelection, rotationDisplayTarget: () => shape,
		rotationTarget: () => context.selection.selectedIds[0] === shape.id ? shape : null, rotationControls: () => [control], requestRotation,
		commitRotation: vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>(), createMoveGesture: vi.fn<SelectToolDeps['createMoveGesture']>(), reportRejected: vi.fn<SelectToolDeps['reportRejected']>(), reportInvalidInput: vi.fn<SelectToolDeps['reportInvalidInput']>() });
	tool.activate(context); tool.pointerDown(pointerAt(control.handle.x, control.handle.y));
	expect(expandSelection).toHaveBeenCalledExactlyOnceWith(shape.id, false); expect(context.selection.selectedIds).toEqual([]); expect(tool.hasDraft()).toBe(false);
	expandSelection.mockReturnValue([shape.id]); tool.pointerDown(pointerAt(control.handle.x, control.handle.y)); tool.pointerUp(pointerAt(control.handle.x, control.handle.y));
	expect(context.selection.selectedIds).toEqual([shape.id]); expect(requestRotation).toHaveBeenCalledExactlyOnceWith(shape.id);
});
function setup(scale = 1) {
	const context = toolContext({ worldPerScreenPixel: scale }).context;
	const control = expectDefined(rotationHandleGeometry(shape, scale), 'control');
	const requestRotation = vi.fn<NonNullable<RotationGestureDeps['requestRotation']>>(), commitRotation = vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>(), previewRotation = vi.fn<NonNullable<RotationGestureDeps['previewRotation']>>();
	const gesture = new ElementRotation({ requestRotation, commitRotation, previewRotation });
	const pointer = (x: number, y: number) => ({ ...pointerAt(x, y), screenPoint: screenPoint(x / scale, y / scale) });
	return { context, control, requestRotation, commitRotation, previewRotation, gesture, pointer };
}
describe('edge rotation click and deliberate drag', () => {
	it.each([0.2, 1, 5])('uses the entire invisible rectangle and a four-screen-pixel threshold at scale %s', scale => {
		const r = setup(scale), { handle, bounds } = r.control;
		expect((bounds.max.x - bounds.min.x) / scale).toBeGreaterThanOrEqual(44);
		expect((bounds.max.y - bounds.min.y) / scale).toBeGreaterThanOrEqual(44);
		const label = { x: handle.x + 15 * scale, y: handle.y + 15 * scale };
		expect(rotationControlContains(bounds, label)).toBe(true);
		expect(resolveSelectionTarget({ candidates: [shape], selectedIds: [shape.id], worldPoint: label, handleToleranceWorld: 8 * scale, rotationHandle: { id: shape.id, bounds } })).toEqual({ id: shape.id, kind: 'rotation' });
		r.gesture.start(r.context, r.pointer(label.x, label.y), shape, r.control);
		r.gesture.move(r.context, r.pointer(label.x + 3 * scale, label.y));
		expect(r.previewRotation).not.toHaveBeenCalled();
		expect(r.context.renderState.rotationInteraction?.dragging).toBe(false);
		r.gesture.finish(r.context, r.pointer(label.x + 4 * scale, label.y));
		expect(r.requestRotation).toHaveBeenCalledExactlyOnceWith(shape.id);
		expect(r.commitRotation).not.toHaveBeenCalled();
		expect(r.context.renderState.rotationInteraction).toBeNull();
	});
	it('cancels a short release outside the pressed control', () => {
		const r = setup(), x = r.control.bounds.max.x - 1, y = r.control.handle.y;
		r.gesture.start(r.context, r.pointer(x, y), shape, r.control);
		r.gesture.finish(r.context, r.pointer(x + 2, y));
		expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled();
	});
	it('never turns a completed drag back into a click when it returns to its start', () => {
		const r = setup(), start = r.pointer(r.control.handle.x, r.control.handle.y);
		r.gesture.start(r.context, start, shape, r.control);
		r.gesture.move(r.context, r.pointer(r.control.handle.x + 40, r.control.handle.y));
		expect(r.context.renderState.rotationInteraction?.dragging).toBe(true);
		r.gesture.finish(r.context, start);
		expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled();
	});
	it('preserves the initial off-centre grab bearing and freezes placement while geometry previews', () => {
		const r = setup(), start = { x: r.control.handle.x + 15, y: r.control.handle.y + 15 }, pivot = r.control.pivot;
		const frozen = structuredClone(r.control);
		r.gesture.start(r.context, r.pointer(start.x, start.y), shape, r.control);
		const end = { x: pivot.x - (start.y - pivot.y), y: pivot.y + (start.x - pivot.x) };
		r.gesture.move(r.context, r.pointer(end.x, end.y));
		expect(r.context.renderState.rotationDegrees).toBeCloseTo(90, 8);
		expect(r.context.renderState.rotationInteraction?.control).toEqual(frozen);
		const preview = expectDefined(r.previewRotation.mock.calls.at(-1)?.[1], 'off-centre preview');
		const expected = expectDefined(rotationPoints(shape, 90, pivot), 'quarter-turn expectation');
		preview.forEach((point, index) => { expect(point.x).toBeCloseTo(expected[index].x, 8); expect(point.y).toBeCloseTo(expected[index].y, 8); });
		r.gesture.finish(r.context, r.pointer(end.x, end.y));
		expect(r.commitRotation).toHaveBeenCalledExactlyOnceWith(shape.id, preview, shape);
		expect(r.requestRotation).not.toHaveBeenCalled();
	});
	it('retains a stable bearing near the pivot and exposes the configured Shift increment', () => {
		const r = setup(), pivot = r.control.pivot;
		r.gesture.start(r.context, r.pointer(pivot.x + 100, pivot.y), shape, r.control);
		const move = r.pointer(pivot.x + 80, pivot.y + 60);
		r.gesture.move(r.context, { ...move, modifiers: { ...move.modifiers, shift: true } });
		const angle = r.context.renderState.rotationDegrees;
		expect(r.context.renderState.rotationInteraction?.snapDegrees).toBe(r.context.snapService.rotationStepDegrees);
		r.gesture.move(r.context, { ...r.pointer(pivot.x + 1, pivot.y - 1), modifiers: { ...move.modifiers, shift: true } });
		expect(r.context.renderState.rotationDegrees).toBe(angle);
		r.gesture.cancel(); expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled();
	});
	it('cancels pending precision input when the selected generation retires', () => {
		const r = setup(), current = { ...shape, generation: 1 };
		const gesture = new ElementRotation({ requestRotation: r.requestRotation, commitRotation: r.commitRotation, rotationTarget: () => ({ ...current, generation: 2 }) });
		gesture.start(r.context, r.pointer(r.control.handle.x, r.control.handle.y), current, r.control);
		gesture.finish(r.context, r.pointer(r.control.handle.x, r.control.handle.y));
		expect(r.requestRotation).not.toHaveBeenCalled(); expect(r.commitRotation).not.toHaveBeenCalled();
	});
});
