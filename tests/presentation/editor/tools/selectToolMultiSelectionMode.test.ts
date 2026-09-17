import { expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool, type SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import { openingHandles, type OpeningGrip } from '../../../../src/presentation/editor/structure/openingHandles';
import type { Opening, Wall } from '../../../../src/domain/spatial/Structure';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import type { EditorPointerEvent } from '../../../../src/presentation/editor/tools/editor-tool';
import { expectDefined } from '../../../helpers/domain';
import { ok } from '../../../../src/core/result/Result';
import { pointerAt, shiftPointerAt, toolContext } from '../../../helpers/tool-context';

const square = (x: number) => [{ x, y: 0 }, { x: x + 100, y: 0 }, { x: x + 100, y: 100 }, { x, y: 100 }];

/**
 * The sidebar's "select multiple" checkbox reaches the canvas as a held Shift. Its own file
 * because `selectTool.test.ts` is at its line budget.
 */
it('makes a plain click add and remove, as Shift does, while the mode is on', () => {
	setActivePinia(createPinia());
	const { context } = toolContext({ commandDispatcher: { run: () => Promise.resolve(ok('wrote')) } });
	let multiple = true;
	const tool = new SelectTool({
		multiSelectionMode: () => multiple,
		spatialObjects: () => [{ id: 'zone-a', points: square(0) }, { id: 'zone-b', points: square(200) }],
		createMoveGesture: () => ({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }),
		reportRejected: () => {},
		reportInvalidInput: () => {},
	});
	tool.activate(context);
	for (const x of [10, 210]) { tool.pointerDown(pointerAt(x, 10)); tool.pointerUp(pointerAt(x, 10)); }
	expect(context.selection.selectedIds).toEqual(['zone-a', 'zone-b']);
	// A click on a member removes it rather than grabbing it for a drag or focusing it.
	tool.pointerDown(pointerAt(10, 10));
	expect(tool.hasDraft()).toBe(false);
	tool.pointerUp(pointerAt(10, 10));
	expect(context.selection.selectedIds).toEqual(['zone-b']);
	multiple = false;
	tool.pointerDown(pointerAt(10, 10));
	expect(context.selection.selectedIds).toEqual(['zone-a']);
});

const wall: Wall = { id: 'wall-a', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, height: 2400, thickness: 200 };
const door: Opening = { id: 'opening-a', kind: 'door', hostId: wall.id, offset: 800, width: 1200, height: 2100, sill: 0 };
const handles = openingHandles(door, wall, 1);
const pointOf = (grip: OpeningGrip) => expectDefined(handles.find(handle => handle.grip === grip), `the ${grip} handle`).point;

/** A selected door with its handles wired, the mode switchable. Every write door is a spy. */
function openingRig(multiple: boolean) {
	setActivePinia(createPinia());
	const stepOpening = vi.fn<NonNullable<SelectToolDeps['stepOpening']>>();
	const previewOpening = vi.fn<NonNullable<SelectToolDeps['previewOpening']>>();
	const commitOpening = vi.fn<NonNullable<SelectToolDeps['commitOpening']>>();
	const { context } = toolContext();
	const tool = new SelectTool({
		multiSelectionMode: () => multiple,
		canMutateGeometry: () => true,
		spatialObjects: () => [{ id: door.id, kind: 'opening', points: [wall.start, wall.end] }],
		createMoveGesture: () => ({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }),
		reportRejected: () => {},
		reportInvalidInput: () => {},
		openingHandles: () => ({ id: door.id, handles }),
		openingTarget: () => ({ opening: door, host: wall }),
		stepOpening, previewOpening, commitOpening,
	});
	tool.activate(context);
	context.selection.select([door.id as EntityId<string>]);
	/** A press and a release in place: a tap, the only gesture a touch user building a set makes. */
	const tap = (event: EditorPointerEvent) => { tool.pointerDown(event); tool.pointerUp(event); };
	return { tool, context, stepOpening, previewOpening, commitOpening, tap };
}

// The mode's Shift is synthetic, so the step dot's Shift exemption must not read it: a touch user
// building a set who taps a door's step dot is choosing, not asking for a 100 mm write.
it('toggles a door out rather than stepping it, when the mode is on and a step dot is tapped', () => {
	const { context, stepOpening, tap } = openingRig(true);
	tap(pointerAt(pointOf('step-forward').x, pointOf('step-forward').y));
	expect(stepOpening).not.toHaveBeenCalled();
	expect(context.selection.selectedIds).toEqual([]);
});

it('toggles a door out rather than dragging it, when the mode is on and its move grip is tapped', () => {
	const { tool, context, previewOpening, commitOpening } = openingRig(true);
	tool.pointerDown(pointerAt(pointOf('move').x, pointOf('move').y));
	expect(tool.hasDraft()).toBe(false);
	tool.pointerUp(pointerAt(pointOf('move').x, pointOf('move').y));
	expect(previewOpening).not.toHaveBeenCalled();
	expect(commitOpening).not.toHaveBeenCalled();
	expect(context.selection.selectedIds).toEqual([]);
});

// Only a step dot reads Shift, so only a step dot is exempt from it: over any other grip a physical
// Shift is the selection modifier it has always been.
it('toggles a door out on a physical Shift over its move grip, rather than starting a drag', () => {
	const { tool, context, previewOpening } = openingRig(false);
	tool.pointerDown(shiftPointerAt(pointOf('move').x, pointOf('move').y));
	expect(tool.hasDraft()).toBe(false);
	tool.pointerMove(shiftPointerAt(2500, 0));
	expect(previewOpening).not.toHaveBeenCalled();
	expect(context.selection.selectedIds).toEqual([]);
});
