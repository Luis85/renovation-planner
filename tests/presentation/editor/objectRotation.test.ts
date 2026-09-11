import { describe, expect, it, vi } from 'vitest';
import { area, centroid, distance } from '../../../src/core/geometry/operations';
import { rotationChanged, rotationHandleGeometry, rotationPivot, rotationPoints, parseRotationDegrees } from '../../../src/presentation/editor/elements/objectRotation';
import { ElementRotation, type RotationGestureDeps } from '../../../src/presentation/editor/elements/ElementRotation';
import { roomDimensions } from '../../../src/presentation/editor/resize/roomDimensions';
import { resolveSelectionTarget } from '../../../src/presentation/editor/selection/resolveSelectionTarget';
import { SelectTool, type SelectToolDeps } from '../../../src/presentation/editor/tools/select-tool';
import { toolContext, pointerAt } from '../../helpers/tool-context';
import { expectDefined, expectOk } from '../../helpers/domain';
import type { SpatialElement } from '../../../src/domain/spatial/SpatialElement';
const element: SpatialElement = { id: 'element-object', kind: 'object', points: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 300 }, { x: 100, y: 300 }] };
const pivot = expectDefined(rotationPivot(element), 'centroid');
const control = expectDefined(rotationHandleGeometry(element, 1), 'control');
function shiftedPointer(x: number, y: number) { const event = pointerAt(x, y); return { ...event, modifiers: { ...event.modifiers, shift: true } }; }
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
		expect(rotationPivot({ ...element, kind: 'measurement' })).toBeNull(); expect(rotationPivot({ ...element, points: element.points.slice(0, 2) })).toBeNull();
		expect(rotationPivot({ ...element, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] })).toBeNull();
		expect(rotationPoints({ ...element, kind: 'path' }, 90, pivot)).not.toBeNull(); expect(rotationPoints(element, Infinity, pivot)).toBeNull(); expect(rotationPoints(element, 90, { x: 1e12, y: 1e12 })).toBeNull();
		expect(rotationPoints(element, 360, pivot)).toBe(element.points);
		for (const value of ['', 'NaN', 'Infinity', '12deg', '1,2.3', '1e999']) expect(parseRotationDegrees(value)).toBeNull();
		expect(parseRotationDegrees(' -12,75 ')).toBe(-12.75); expect(parseRotationDegrees('+12.75')).toBe(12.75); expect(parseRotationDegrees('9'.repeat(400))).toBeNull();
	});
	it('previews without drift and commits the final release position exactly once with Shift snapping', () => {
		const context = toolContext().context, previewRotation = vi.fn<NonNullable<RotationGestureDeps['previewRotation']>>(), commitRotation = vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>(), gesture = new ElementRotation({ previewRotation, commitRotation });
		gesture.move(context, pointerAt(0, 0)); gesture.finish(context, pointerAt(0, 0));
		gesture.start(context, pointerAt(400, 200), element, control);
		for (let n = 0; n < 100; n++) gesture.move(context, pointerAt(350, 286.602540378));
		const expected = rotationPoints(element, 60, pivot); const preview = expectDefined(previewRotation.mock.calls.at(-1)?.[1], 'preview');
		expect(preview[0].x).toBeCloseTo(expected?.[0].x ?? 0, 6);
		gesture.finish(context, { ...pointerAt(300, 300), button: 'secondary' }); expect(gesture.active).toBe(true);
		const release = pointerAt(330, 300); const snapped = { ...release, modifiers: { ...release.modifiers, shift: true } };
		gesture.move(context, snapped); const finalPreview = previewRotation.mock.calls.at(-1)?.[1];
		gesture.finish(context, snapped); gesture.finish(context, snapped);
		expect(commitRotation).toHaveBeenCalledExactlyOnceWith(element.id, finalPreview, element); expect(gesture.active).toBe(false); expect(previewRotation).toHaveBeenLastCalledWith(element.id, finalPreview);
		commitRotation.mockClear(); gesture.start(context, pointerAt(400, 200), element, control); gesture.move(context, pointerAt(350, 250)); gesture.finish(context, pointerAt(300, 300));
		expect(commitRotation).toHaveBeenCalledExactlyOnceWith(element.id, rotationPoints(element, 90, pivot), element);
	});
	it('drops blocked, cancelled, zero-angle and pivot releases without committing', () => {
		const context = toolContext().context, commitRotation = vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>(), gesture = new ElementRotation({ commitRotation });
		const unavailable = new ElementRotation({ commitRotation, canRotateShape: () => false }); unavailable.start(context, pointerAt(400, 200), element, control); expect(unavailable.active).toBe(false);
		new ElementRotation({}).start(context, pointerAt(400, 200), element, control);
		gesture.start(context, pointerAt(400, 200), { ...element, kind: 'measurement' }, control); expect(gesture.active).toBe(false);
		gesture.start(toolContext({ writesBlocked: true }).context, pointerAt(400, 200), element, control); expect(gesture.active).toBe(false);
		for (const modifier of ['alt'] as const) { const event = pointerAt(400, 200); gesture.start(context, { ...event, modifiers: { ...event.modifiers, [modifier]: true } }, element, control); expect(gesture.active).toBe(false); }
		gesture.start(context, pointerAt(400, 200), element, control); gesture.finish(context, pointerAt(400, 200));
		gesture.start(context, pointerAt(400, 200), element, control); gesture.move(context, pointerAt(300, 200)); gesture.finish(context, pointerAt(300, 200));
		gesture.start(context, pointerAt(400, 200), element, control); gesture.cancel(); gesture.finish(context, pointerAt(300, 300));
		gesture.start(context, pointerAt(400, 200), element, control); gesture.finish(toolContext({ writesBlocked: true }).context, pointerAt(300, 300)); expect(commitRotation).not.toHaveBeenCalled();
	});
	it.each([0.1, 2, 50])('shares hover/click handle targeting at %s world units per pixel and cancels tool disposal', scale => {
		const r = toolContext({ worldPerScreenPixel: scale }), commitRotation = vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>();
		r.context.selection.select([element.id as never]);
		const tool = new SelectTool({ spatialObjects: () => [element], rotationTarget: () => element, rotationControl: () => rotationHandleGeometry(element, scale), commitRotation, createMoveGesture: vi.fn<SelectToolDeps['createMoveGesture']>(), reportRejected: vi.fn<SelectToolDeps['reportRejected']>(), reportInvalidInput: vi.fn<SelectToolDeps['reportInvalidInput']>() }); tool.activate(r.context);
		const handle = expectDefined(rotationHandleGeometry(element, scale), 'handle geometry').handle;
		tool.pointerMove(pointerAt(handle.x, handle.y)); expect(r.context.renderState.hoveredTargetKind).toBe('rotation');
		const start = pointerAt(handle.x, handle.y); tool.pointerDown({ ...start, modifiers: { ...start.modifiers, shift: true } }); expect(tool.hasDraft()).toBe(true);
		tool.pointerMove(pointerAt(500, 200)); tool.deactivate(); tool.pointerUp(pointerAt(500, 200)); expect(commitRotation).not.toHaveBeenCalled();
		tool.activate(r.context); tool.pointerDown(pointerAt(handle.x, handle.y)); tool.cancel(); tool.pointerUp(pointerAt(500, 200)); expect(commitRotation).not.toHaveBeenCalled();
		tool.pointerDown(pointerAt(handle.x, handle.y)); tool.pointerUp(pointerAt(pivot.x + 100 * scale, pivot.y)); expect(commitRotation).toHaveBeenCalledOnce();
	});
});



it.each(['room', 'area', 'object', 'path', 'fence', 'measurement', 'wall'] as const)('rotates %s rigidly around its kind-specific frozen centre', kind => {
	const shape = { id: 'shape', kind, points: kind === 'measurement' || kind === 'wall' ? [{ x: 0, y: 0 }, { x: 300, y: 400 }] : element.points };
	const centre = expectDefined(rotationPivot(shape), 'pivot');
	for (const degrees of [27.25, 90, -90]) {
		const points = expectDefined(rotationPoints(shape, degrees, centre), 'points'), rotatedCentre = expectDefined(rotationPivot({ ...shape, points }), 'rotated pivot');
		expect(rotatedCentre.x).toBeCloseTo(centre.x, 8); expect(rotatedCentre.y).toBeCloseTo(centre.y, 8);
		for (let index = 1; index < points.length; index++) expect(distance(points[index - 1], points[index])).toBeCloseTo(distance(shape.points[index - 1], shape.points[index]), 8);
	}
});
it('weights an open path by segment length and keeps the labelled control inside visible camera bounds', () => {
	const shape = { id: 'path', kind: 'path' as const, points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }] };
	expect(rotationPivot(shape)).toEqual({ x: 187.5, y: 12.5 });
	const placed = expectDefined(rotationHandleGeometry(shape, 2, { min: { x: 0, y: 0 }, max: { x: 400, y: 400 } }), 'placed control');
	expect(placed.bounds.min.x).toBeGreaterThanOrEqual(0); expect(placed.bounds.max.x).toBeLessThanOrEqual(400);
	expect((placed.bounds.max.x - placed.bounds.min.x) / 2).toBeGreaterThanOrEqual(44);
});
it('unwraps the atan2 seam without a spurious reverse turn while keeping previews rigid', () => {
	const context = toolContext().context, commitRotation = vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>(), gesture = new ElementRotation({ commitRotation });
	const at = (degrees: number) => pointerAt(pivot.x + Math.cos(degrees * Math.PI / 180) * 100, pivot.y + Math.sin(degrees * Math.PI / 180) * 100);
	gesture.start(context, at(170), element, control); gesture.move(context, at(-170)); expect(context.renderState.rotationDegrees).toBeCloseTo(20, 8);
	gesture.move(context, at(-100)); expect(context.renderState.rotationDegrees).toBeCloseTo(90, 8); gesture.finish(context, at(-100));
	const points = expectDefined(commitRotation.mock.calls[0]?.[1], 'committed'); expect(points[0].x).toBeCloseTo(400, 8); expect(points[0].y).toBeCloseTo(0, 8);
});


it.each([0.2, 1, 4])('keeps a clamped rotation target clear of Room vertex handles at %s world units per pixel', scale => {
	const point = (x: number, y: number) => ({ x: 1000 + x * scale, y: -500 + y * scale });
	const shape = { id: 'room-clamped', kind: 'room' as const, points: [point(100, 60), point(472, 60), point(472, 300), point(100, 300)] };
	const placement = expectDefined(rotationHandleGeometry(shape, scale, { min: point(0, 0), max: point(500, 400) }), 'clear placement');
	expect(placement.handle).toEqual(point(193, 42)); expect(placement.anchor).toEqual(point(193, 60));
	for (const vertex of shape.points) expect(distance(placement.handle, vertex) / scale).toBeGreaterThanOrEqual(34);
	expect(resolveSelectionTarget({ candidates: [{ id: shape.id, points: shape.points }], selectedIds: [shape.id], worldPoint: shape.points[1], handleToleranceWorld: 8 * scale, rotationHandle: { id: shape.id, bounds: placement.bounds } })).toEqual({ id: shape.id, kind: 'handle', vertexIndex: 1 });
});
it('slides a viewport-filling Room handle away from clipped corners and avoids measured native controls', () => {
	const visible = { min: { x: 0, y: 0 }, max: { x: 500, y: 400 } };
	const shape = { id: 'room-full', kind: 'room' as const, points: [{ x: 28, y: 60 }, { x: 472, y: 60 }, { x: 472, y: 372 }, { x: 28, y: 372 }] };
	const placement = expectDefined(rotationHandleGeometry(shape, 1, visible), 'slid placement'); expect(placement.handle).toEqual({ x: 139, y: 42 });
	const obstruction = { min: { x: 110, y: 10 }, max: { x: 165, y: 70 } };
	const shifted = expectDefined(rotationHandleGeometry(shape, 1, visible, [obstruction]), 'native-control clearance'); expect(shifted.handle).not.toEqual(placement.handle);
	for (const vertex of shape.points) expect(distance(shifted.handle, vertex)).toBeGreaterThanOrEqual(34);
	expect(rotationHandleGeometry(shape, 1, visible, [visible])).toBeNull();
	expect(rotationHandleGeometry(shape, 1, { min: { x: 0, y: 0 }, max: { x: 40, y: 70 } })).toBeNull();
});


it('keeps Shift-click Room corners as selection toggles while Shift-grabbing rotation still edits', () => {
	const shape = { id: 'room-shift', kind: 'room' as const, points: element.points }, r = toolContext(); r.context.selection.select([shape.id as never]);
	const handle = expectDefined(rotationHandleGeometry(shape, 1), 'handle').handle, createMoveGesture = vi.fn<SelectToolDeps['createMoveGesture']>(), commitRotation = vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>();
	const tool = new SelectTool({ spatialObjects: () => [{ id: shape.id, points: shape.points }], rotationTarget: () => shape, rotationControl: () => rotationHandleGeometry(shape, 1), commitRotation, createMoveGesture, reportRejected: vi.fn<SelectToolDeps['reportRejected']>(), reportInvalidInput: vi.fn<SelectToolDeps['reportInvalidInput']>() }); tool.activate(r.context);
	tool.pointerDown(shiftedPointer(101, 101)); expect(tool.hasDraft()).toBe(false); expect(r.context.selection.selectedIds).toEqual([]); expect(createMoveGesture).not.toHaveBeenCalled();
	r.context.selection.select([shape.id as never]); tool.pointerDown(shiftedPointer(handle.x, handle.y)); expect(tool.hasDraft()).toBe(true);
	tool.pointerUp(shiftedPointer(pivot.x, pivot.y + 200)); expect(commitRotation).toHaveBeenCalledOnce(); expect(createMoveGesture).not.toHaveBeenCalled();
});




it.each([90, -90, 180, 270, 450, -450])('keeps exact axis-aligned Room dimensions usable after %s degrees', degrees => {
	const shape = { id: 'room-cardinal', kind: 'room' as const, points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 3000 }, { x: 0, y: 3000 }] };
	const points = expectDefined(rotationPoints(shape, degrees, expectDefined(rotationPivot(shape), 'pivot')), 'cardinal points');
	const box = expectDefined(roomDimensions(points), 'axis-aligned Room remains resizable');
	expect(box.max.x - box.min.x).toBe(degrees % 180 === 0 ? 4000 : 3000); expect(box.max.y - box.min.y).toBe(degrees % 180 === 0 ? 3000 : 4000);
});

it('answers no pivot for an open path whose consecutive points coincide', () => {
	// The length-weighted centre divides by the total length, so a zero-length span has no
	// centre to report rather than a NaN one.
	expect(rotationPivot({ id: 'path-collapsed', kind: 'path', points: [{ x: 500, y: 500 }, { x: 500, y: 500 }] })).toBeNull();
	expect(rotationPivot({ id: 'path-open', kind: 'path', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] })).toEqual({ x: 500, y: 0 });
});

it('abandons a running rotation as soon as its shape stops being rotatable', () => {
	const context = toolContext().context, previewRotation = vi.fn<NonNullable<RotationGestureDeps['previewRotation']>>();
	let permitted = true;
	const gesture = new ElementRotation({ previewRotation, commitRotation: vi.fn<NonNullable<RotationGestureDeps['commitRotation']>>(), canRotateShape: () => permitted });
	gesture.start(context, pointerAt(600, 200), element, control);
	expect(gesture.active).toBe(true);
	permitted = false;
	gesture.move(context, pointerAt(600, 260));
	expect(gesture.active).toBe(false);
	expect(previewRotation).toHaveBeenLastCalledWith(null);
	expect(context.renderState.rotationDegrees).toBeNull();
});
