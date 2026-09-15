import { describe, expect, it, vi } from 'vitest';
import { ElementRotation, type RotationGestureDeps } from '../../../src/presentation/editor/elements/ElementRotation';
import { rotationHandleGeometry, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { layoutRotationControl, rotationControlContains } from '../../../src/presentation/editor/elements/rotationControl';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { screenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import { pointerAt, toolContext } from '../../helpers/tool-context';
import { expectDefined } from '../../helpers/domain';

const shape = { id: 'object', kind: 'object' as const, points: [{ x: 100, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 400 }, { x: 100, y: 400 }] };
const centre = { x: 300, y: 300 };
const cover = (point: { x: number; y: number }) => ({ min: { x: point.x - 1, y: point.y - 1 }, max: { x: point.x + 1, y: point.y + 1 } });
const wall = (bulge: number) => ({ id: 'wall', kind: 'wall' as const, points: [{ x: 100, y: 300 }, { x: 500, y: 300 }], wall: { id: 'wall', bulge } });
describe('Konva-style rotate handle layout', () => {
	it.each([0.2, 1, 4])('stands a 32px arrow 30px above the top-middle of the box, clear of its edge, at scale %s', scale => {
		const control = expectDefined(layoutRotationControl(shape, centre, scale), 'rotate handle');
		expect(control.anchor).toEqual({ x: 300, y: 200 });
		expect(control.handle).toEqual({ x: 300, y: 200 - 30 * scale });
		expect((control.bounds.max.x - control.bounds.min.x) / scale).toBeCloseTo(32); expect((control.bounds.max.y - control.bounds.min.y) / scale).toBeCloseTo(32);
		// Never reaches the vertex grab radius plus clearance of a handle on the edge beneath it.
		expect((200 - control.bounds.max.y) / scale).toBeGreaterThan(12);
	});
	it('pushes the arrow out past a dimension label on the middle of its side, its stem running beneath', () => {
		const label = { min: { x: 280, y: 150 }, max: { x: 320, y: 180 } };
		// Clear of the label's top by the 4px clearance and a pixel: 200 − 150 + 16 + 4 + 1 = 71 out.
		expect(layoutRotationControl(shape, centre, 1, undefined, [label])).toMatchObject({ anchor: { x: 300, y: 200 }, handle: { x: 300, y: 129 } });
		// A second control there would push it 93px out, past the 90px reach, so the top is given up.
		expect(layoutRotationControl(shape, centre, 1, undefined, [label, cover({ x: 300, y: 129 })])).toMatchObject({ anchor: { x: 300, y: 400 }, handle: { x: 300, y: 430 } });
	});
	it('tries the bottom, left and right sides in turn when the view clips a side or pushing passes its reach', () => {
		const visible = { min: { x: 0, y: 180 }, max: { x: 600, y: 600 } };
		const belowToTheEdge = { min: { x: 290, y: 405 }, max: { x: 310, y: 600 } }, leftToTheEdge = { min: { x: 0, y: 290 }, max: { x: 95, y: 310 } };
		expect(layoutRotationControl(shape, centre, 1, visible)).toMatchObject({ anchor: { x: 300, y: 400 }, handle: { x: 300, y: 430 } });
		expect(layoutRotationControl(shape, centre, 1, visible, [belowToTheEdge])).toMatchObject({ anchor: { x: 100, y: 300 }, handle: { x: 70, y: 300 } });
		expect(layoutRotationControl(shape, centre, 1, visible, [belowToTheEdge, leftToTheEdge])).toMatchObject({ anchor: { x: 500, y: 300 }, handle: { x: 530, y: 300 } });
		expect(layoutRotationControl(shape, centre, 1, visible, [visible])).toBeNull();
		expect(layoutRotationControl(shape, centre, 1, { min: { x: 0, y: 0 }, max: { x: 30, y: 30 } })).toBeNull();
	});
	it('slides along a side wider than the view, and never past the box, so the stem always meets it', () => {
		const wide = { ...shape, points: [{ x: -1000, y: 200 }, { x: 2000, y: 200 }, { x: 2000, y: 400 }, { x: -1000, y: 400 }] };
		expect(layoutRotationControl(wide, centre, 1, { min: { x: 0, y: 0 }, max: { x: 500, y: 600 } })).toMatchObject({ anchor: { x: 480, y: 200 }, handle: { x: 480, y: 170 } });
		// Top-middle would need a foot at x 510, past the box's right side, so the arrow takes that side instead.
		expect(layoutRotationControl(shape, centre, 1, { min: { x: 490, y: 0 }, max: { x: 900, y: 600 } })).toMatchObject({ anchor: { x: 500, y: 300 }, handle: { x: 530, y: 300 } });
	});
	it('measures a wall by its own arc, a hosted item by its own points, and refuses an outline with no box', () => {
		expect([1, -1].map(bulge => expectDefined(layoutRotationControl(wall(bulge), centre, 1), 'wall handle').anchor.y).toSorted((a, b) => a - b)).toEqual([100, 300]);
		const hosted = expectDefined(layoutRotationControl({ ...shape, wall: { id: 'wall', bulge: 1 } }, centre, 1), 'hosted handle');
		expect(hosted).toMatchObject({ anchor: { x: 300, y: 200 }, hostWall: true });
		expect(layoutRotationControl({ ...shape, points: [] }, centre, 1)).toBeNull();
	});
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
		expect((bounds.max.x - bounds.min.x) / scale).toBeCloseTo(32);
		expect((bounds.max.y - bounds.min.y) / scale).toBeCloseTo(32);
		// Off the drawn arrow but inside the target, far enough in that a 4px release stays inside it.
		const label = { x: handle.x + 12 * scale, y: handle.y + 12 * scale };
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
		expect(r.context.renderState.rotationInteraction?.snapDegrees).toBe(r.context.snapService.rotationStepDegrees());
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
