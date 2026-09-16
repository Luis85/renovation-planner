import { expect, it, vi } from 'vitest';
import { SelectTool, type SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import { openingHandles } from '../../../../src/presentation/editor/structure/openingHandles';
import type { OpeningGrip } from '../../../../src/presentation/editor/structure/openingHandles';
import type { Opening, Wall } from '../../../../src/domain/spatial/Structure';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import { ok } from '../../../../src/core/result/Result';
import { expectDefined } from '../../../helpers/domain';
import { pointerAt, shiftPointerAt, toolContext } from '../../../helpers/tool-context';

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 1200, height: 2100, sill: 0 };
/** The handles as the tool will see them, so a press lands exactly where one is drawn. */
const handles = openingHandles(door, wall, 1);
const pointOf = (grip: OpeningGrip): { readonly x: number; readonly y: number } =>
	expectDefined(handles.find(handle => handle.grip === grip), `the ${grip} handle`).point;

function harness(overrides: Partial<SelectToolDeps> = {}) {
	const stepOpening = vi.fn<NonNullable<SelectToolDeps['stepOpening']>>();
	const flipOpening = vi.fn<NonNullable<SelectToolDeps['flipOpening']>>();
	const previewOpening = vi.fn<NonNullable<SelectToolDeps['previewOpening']>>();
	const commitOpening = vi.fn<NonNullable<SelectToolDeps['commitOpening']>>();
	const { context } = toolContext();
	const tool = new SelectTool({
		canMutateGeometry: () => true,
		spatialObjects: () => [{ id: door.id, kind: 'opening', points: [wall.start, wall.end] }],
		createMoveGesture: () => ({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }),
		reportRejected: () => {},
		reportInvalidInput: () => {},
		openingHandles: () => ({ id: door.id, handles }),
		openingTarget: () => ({ opening: door, host: wall }),
		stepOpening, flipOpening, previewOpening, commitOpening,
		...overrides,
	});
	tool.activate(context);
	context.selection.select([door.id as EntityId<string>]);
	return { tool, context, stepOpening, flipOpening, previewOpening, commitOpening };
}

const press = (point: { readonly x: number; readonly y: number }) => pointerAt(point.x, point.y);
const shiftPress = (point: { readonly x: number; readonly y: number }) => shiftPointerAt(point.x, point.y);

it('steps the opening forward and back from its arrow grips, by the shift step with shift held', () => {
	const { tool, stepOpening, previewOpening } = harness();
	tool.pointerDown(press(pointOf('step-forward')));
	expect(stepOpening).toHaveBeenCalledWith(door.id, 10);
	tool.pointerDown(press(pointOf('step-back')));
	expect(stepOpening).toHaveBeenLastCalledWith(door.id, -10);
	tool.pointerDown(shiftPress(pointOf('step-forward')));
	expect(stepOpening).toHaveBeenLastCalledWith(door.id, 100);
	// A tap starts nothing: an arrow has no preview between a press and a release.
	expect(previewOpening).not.toHaveBeenCalled();
	expect(tool.hasDraft()).toBe(false);
});

it('flips the leaf from either chevron', () => {
	const { tool, flipOpening } = harness();
	tool.pointerDown(press(pointOf('side-left')));
	expect(flipOpening).toHaveBeenCalledWith(door.id, 'left');
	tool.pointerDown(press(pointOf('side-right')));
	expect(flipOpening).toHaveBeenLastCalledWith(door.id, 'right');
});

it('starts a drag from a width or move grip, and no drag at all from an arrow', () => {
	const dragged = harness();
	dragged.tool.pointerDown(press(pointOf('width-end')));
	dragged.tool.pointerMove(pointerAt(2500, 0));
	expect(dragged.previewOpening).toHaveBeenCalled();
	const tapped = harness();
	tapped.tool.pointerDown(press(pointOf('step-forward')));
	tapped.tool.pointerMove(pointerAt(2500, 0));
	expect(tapped.previewOpening).not.toHaveBeenCalled();
});

it('commits a width drag on release', () => {
	const { tool, commitOpening } = harness();
	tool.pointerDown(press(pointOf('width-end')));
	tool.pointerMove(pointerAt(2500, 0));
	tool.pointerUp(pointerAt(2500, 0));
	expect(commitOpening).toHaveBeenCalledWith(door.id, { ...door, offset: 800, width: 1700 });
});

it('selects the opening instead of editing it when geometry cannot be mutated', () => {
	const { tool, context, stepOpening, previewOpening } = harness({ canMutateGeometry: () => false });
	tool.pointerDown(press(pointOf('step-forward')));
	expect(stepOpening).not.toHaveBeenCalled();
	expect(previewOpening).not.toHaveBeenCalled();
	expect(context.selection.selectedIds.map(String)).toEqual([door.id]);
});

it('abandons an opening drag when the gesture is cancelled', () => {
	const { tool, previewOpening, commitOpening } = harness();
	tool.pointerDown(press(pointOf('move')));
	tool.pointerMove(pointerAt(2500, 0));
	// Escape routes through `hasDraft`, so a drag invisible to it would clear the selection
	// instead of abandoning the drag; `tracksPointer` is what lets the plan scroll under it.
	expect(tool.hasDraft()).toBe(true);
	expect(tool.tracksPointer()).toBe(true);
	expect(tool.cancelGeometryGesture()).toBe(true);
	expect(previewOpening).toHaveBeenLastCalledWith(null);
	expect(commitOpening).not.toHaveBeenCalled();
});

it('offers no grip where the facade answers no handles, and writes nothing where no door is wired', () => {
	const none = harness({ openingHandles: () => null });
	none.tool.pointerDown(press(pointOf('step-forward')));
	expect(none.stepOpening).not.toHaveBeenCalled();
	const unwired = harness({ openingHandles: undefined, stepOpening: undefined, flipOpening: undefined });
	unwired.tool.pointerDown(press(pointOf('step-forward')));
	expect(unwired.stepOpening).not.toHaveBeenCalled();
	const deaf = harness({ stepOpening: undefined, flipOpening: undefined });
	deaf.tool.pointerDown(press(pointOf('step-forward')));
	deaf.tool.pointerDown(press(pointOf('side-left')));
	expect(deaf.tool.hasDraft()).toBe(false);
});
