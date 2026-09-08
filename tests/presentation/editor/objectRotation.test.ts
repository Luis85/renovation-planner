import { describe, expect, it, vi } from 'vitest';
import { area, centroid, distance } from '../../../src/core/geometry/operations';
import { rotationChanged, rotationHandle, rotationPivot, rotationPoints, parseRotationDegrees } from '../../../src/presentation/editor/elements/objectRotation';
import { ElementRotation } from '../../../src/presentation/editor/elements/ElementRotation';
import { SelectTool } from '../../../src/presentation/editor/tools/select-tool';
import { toolContext, pointerAt } from '../../helpers/tool-context';
import { expectDefined, expectOk } from '../../helpers/domain';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
const element: SpatialElement = { id: 'element-object', kind: 'object', points: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 300 }, { x: 100, y: 300 }] };
const pivot = expectDefined(rotationPivot(element), 'centroid');
describe('rigid Object rotation', () => {
	it.each([15.25, 90, -90, 179, 360, -720])('preserves centroid, area and all pair distances for %s degrees', degrees => {
		const before = structuredClone(element), points = expectDefined(rotationPoints(element, degrees, pivot), 'points');
		expect(expectOk(area({ points }))).toBeCloseTo(expectOk(area(element)), 7);
		const centre = expectOk(centroid({ points })); expect(centre.x).toBeCloseTo(pivot.x, 10); expect(centre.y).toBeCloseTo(pivot.y, 10);
		for (let a = 0; a < points.length; a++) for (let b = 0; b < points.length; b++) expect(distance(points[a], points[b])).toBeCloseTo(distance(element.points[a], element.points[b]), 10);
		expect(element).toEqual(before); expect(rotationChanged(element.points, points)).toBe(degrees % 360 !== 0);
	});
	it('uses the polygon area centroid rather than the mean of vertices', () => {
		const triangle = { ...element, points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 300 }, { x: 300, y: 300 }, { x: 0, y: 100 }] };
		const centre = expectDefined(rotationPivot(triangle), 'centroid'); expect(centre.y).not.toBe(140);
		const points = expectDefined(rotationPoints(triangle, 32.75, centre), 'rotated');
		expect(expectOk(centroid({ points })).x).toBeCloseTo(centre.x, 10); expect(expectOk(centroid({ points })).y).toBeCloseTo(centre.y, 10);
	});
	 it('refuses unsupported, degenerate, nonfinite and out-of-bound results and parses decimal comma exactly', () => {
		expect(rotationPivot({ ...element, kind: 'path' })).toBeNull(); expect(rotationPivot({ ...element, points: element.points.slice(0, 2) })).toBeNull();
		expect(rotationPivot({ ...element, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] })).toBeNull();
		expect(rotationPoints({ ...element, kind: 'path' }, 90, pivot)).toBeNull(); expect(rotationPoints(element, Infinity, pivot)).toBeNull(); expect(rotationPoints(element, 90, { x: 1e12, y: 1e12 })).toBeNull();
		expect(rotationPoints(element, 360, pivot)).toBe(element.points);
		for (const value of ['', 'NaN', 'Infinity', '12deg', '1,2.3', '1e999']) expect(parseRotationDegrees(value)).toBeNull();
		expect(parseRotationDegrees(' -12,75 ')).toBe(-12.75); expect(parseRotationDegrees('+12.75')).toBe(12.75); expect(parseRotationDegrees('9'.repeat(400))).toBeNull();
	});
	it('previews without drift and commits the final release position exactly once with Shift snapping', () => {
		const context = toolContext().context, previewElement = vi.fn(), moveElement = vi.fn(), gesture = new ElementRotation({ previewElement, moveElement });
		gesture.move(context, pointerAt(0, 0)); gesture.finish(context, pointerAt(0, 0));
		gesture.start(context, pointerAt(400, 200), element);
		for (let n = 0; n < 100; n++) gesture.move(context, pointerAt(350, 286.602540378));
		const expected = rotationPoints(element, 60, pivot); const preview = previewElement.mock.calls.at(-1)?.[1];
		expect(preview[0].x).toBeCloseTo(expected?.[0].x ?? 0, 6);
		gesture.finish(context, { ...pointerAt(300, 300), button: 'secondary' }); expect(gesture.active).toBe(true);
		const release = pointerAt(330, 300); const snapped = { ...release, modifiers: { ...release.modifiers, shift: true } };
		gesture.move(context, snapped); const finalPreview = previewElement.mock.calls.at(-1)?.[1];
		gesture.finish(context, snapped); gesture.finish(context, snapped);
		expect(moveElement).toHaveBeenCalledExactlyOnceWith(element.id, finalPreview, element); expect(gesture.active).toBe(false); expect(previewElement).toHaveBeenLastCalledWith(null);
		moveElement.mockClear(); gesture.start(context, pointerAt(400, 200), element); gesture.move(context, pointerAt(350, 250)); gesture.finish(context, pointerAt(300, 300));
		expect(moveElement).toHaveBeenCalledExactlyOnceWith(element.id, rotationPoints(element, 90, pivot), element);
	});
	it('drops blocked, cancelled, zero-angle and pivot releases without committing', () => {
		const context = toolContext().context, moveElement = vi.fn(), gesture = new ElementRotation({ moveElement });
		const unavailable = new ElementRotation({ moveElement, canRotateElement: () => false }); unavailable.start(context, pointerAt(400, 200), element); expect(unavailable.active).toBe(false);
		new ElementRotation({}).start(context, pointerAt(400, 200), element);
		gesture.start(context, pointerAt(400, 200), { ...element, kind: 'path' }); expect(gesture.active).toBe(false);
		gesture.start(toolContext({ writesBlocked: true }).context, pointerAt(400, 200), element); expect(gesture.active).toBe(false);
		for (const modifier of ['alt'] as const) { const event = pointerAt(400, 200); gesture.start(context, { ...event, modifiers: { ...event.modifiers, [modifier]: true } }, element); expect(gesture.active).toBe(false); }
		gesture.start(context, pointerAt(400, 200), element); gesture.finish(context, pointerAt(400, 200));
		gesture.start(context, pointerAt(400, 200), element); gesture.move(context, pointerAt(300, 200)); gesture.finish(context, pointerAt(300, 200));
		gesture.start(context, pointerAt(400, 200), element); gesture.cancel(); gesture.finish(context, pointerAt(300, 300));
		gesture.start(context, pointerAt(400, 200), element); gesture.finish(toolContext({ writesBlocked: true }).context, pointerAt(300, 300)); expect(moveElement).not.toHaveBeenCalled();
	});
	it.each([0.1, 2, 50])('shares hover/click handle targeting at %s world units per pixel and cancels tool disposal', scale => {
		const r = toolContext({ worldPerScreenPixel: scale }), moveElement = vi.fn();
		r.context.selection.select([element.id as never]);
		const tool = new SelectTool({ spatialObjects: () => [element], moveElement, createMoveGesture: vi.fn(), reportRejected: vi.fn(), reportInvalidInput: vi.fn() }); tool.activate(r.context);
		const handle = expectDefined(rotationHandle(element, scale), 'handle');
		tool.pointerMove(pointerAt(handle.x, handle.y)); expect(r.context.renderState.hoveredTargetKind).toBe('rotation');
		tool.pointerDown(pointerAt(handle.x, handle.y)); expect(tool.hasDraft()).toBe(true);
		tool.pointerMove(pointerAt(500, 200)); tool.deactivate(); tool.pointerUp(pointerAt(500, 200)); expect(moveElement).not.toHaveBeenCalled();
		tool.activate(r.context); tool.pointerDown(pointerAt(handle.x, handle.y)); tool.cancel(); tool.pointerUp(pointerAt(500, 200)); expect(moveElement).not.toHaveBeenCalled();
		tool.pointerDown(pointerAt(handle.x, handle.y)); tool.pointerUp(pointerAt(500, 200)); expect(moveElement).toHaveBeenCalledOnce();
	});
});
