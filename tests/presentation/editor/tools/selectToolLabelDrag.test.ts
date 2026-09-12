import { expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool, type SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import { ok } from '../../../../src/core/result/Result';
import { pointerAt, toolContext } from '../../../helpers/tool-context';
import { cursorClassFor } from '../../../../src/presentation/editor/surface/cursor';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import type { Vector } from '../../../../src/core/geometry/Vector';

/**
 * ADR-0029: a SELECTED item's caption is a drag target. Its own file because `selectTool.test.ts`
 * is at its line budget.
 */
const room = { id: 'zone-a', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }] };
const caption = { id: 'zone-a', bounds: { min: { x: 400, y: 450 }, max: { x: 600, y: 520 } }, offset: { dx: 0, dy: 20 } };
const zoneA = 'zone-a' as EntityId<string>;

function rig(options: { readonly writesBlocked?: boolean; readonly multiple?: boolean } = {}) {
	setActivePinia(createPinia());
	const { context } = toolContext({ ...(options.writesBlocked ? { writesBlocked: true } : {}), commandDispatcher: { run: () => Promise.resolve(ok('wrote')) } });
	const moves: { id: string; offset: Vector }[] = [], bodyMoves: string[] = [];
	const deps: SelectToolDeps = {
		multiSelectionMode: () => options.multiple === true,
		spatialObjects: () => [room],
		labelHits: () => [caption],
		moveLabel: (id, offset) => { moves.push({ id, offset }); },
		createMoveGesture: (zoneId) => { bodyMoves.push(zoneId); return { execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }; },
		reportRejected: () => {},
		reportInvalidInput: () => {},
	};
	const tool = new SelectTool(deps);
	tool.activate(context);
	return { context, tool, moves, bodyMoves };
}

it('drags a selected caption from where it is drawn, previewing and then saving one offset', () => {
	const { context, tool, moves, bodyMoves } = rig();
	context.selection.select([zoneA]);
	tool.pointerMove(pointerAt(500, 500));
	expect(context.renderState.hoveredTargetKind).toBe('label');
	expect(cursorClassFor({ activeToolId: 'select', panPhase: 'idle', hoveredObjectId: 'zone-a', hoveredTargetKind: 'label' })).toBe('rp-plan-canvas-grab');
	tool.pointerDown(pointerAt(500, 500));
	tool.pointerMove(pointerAt(560, 470));
	expect(context.renderState.labelPreview).toEqual({ id: 'zone-a', offset: { dx: 60, dy: -10 } });
	tool.pointerUp(pointerAt(560, 470));
	expect(moves).toEqual([{ id: 'zone-a', offset: { dx: 60, dy: -10 } }]);
	// Left up at the drop: `moveLabel` clears it once the write is read back.
	expect(context.renderState.labelPreview).toEqual({ id: 'zone-a', offset: { dx: 60, dy: -10 } });
	expect(bodyMoves).toEqual([]);
	expect(context.selection.selectedIds).toEqual(['zone-a']);
});

it('treats a press that does not travel as a click: no save, no preview', () => {
	const { context, tool, moves } = rig();
	context.selection.select([zoneA]);
	tool.pointerDown(pointerAt(500, 500)); tool.pointerMove(pointerAt(502, 501)); tool.pointerUp(pointerAt(502, 501));
	expect(moves).toEqual([]);
	expect(context.renderState.labelPreview).toBeNull();
});

it('cancels a caption drag without saving, and starts none while writes are blocked', () => {
	const live = rig();
	live.context.selection.select([zoneA]);
	live.tool.pointerDown(pointerAt(500, 500)); live.tool.pointerMove(pointerAt(600, 600));
	live.tool.pointerUp(pointerAt(600, 600, 'secondary'));
	expect(live.tool.hasDraft()).toBe(true);
	live.tool.cancel();
	expect(live.tool.hasDraft()).toBe(false);
	expect(live.context.renderState.labelPreview).toBeNull();
	live.tool.pointerUp(pointerAt(600, 600));
	expect(live.moves).toEqual([]);
	const blocked = rig({ writesBlocked: true });
	blocked.context.selection.select([zoneA]);
	blocked.tool.pointerDown(pointerAt(500, 500)); blocked.tool.pointerMove(pointerAt(600, 600)); blocked.tool.pointerUp(pointerAt(600, 600));
	expect(blocked.moves).toEqual([]);
	expect(blocked.context.renderState.labelPreview).toBeNull();
});

it('leaves an unselected room, and the select-multiple mode, to their ordinary click', () => {
	const unselected = rig();
	unselected.tool.pointerDown(pointerAt(500, 500)); unselected.tool.pointerMove(pointerAt(600, 600)); unselected.tool.pointerUp(pointerAt(600, 600));
	expect(unselected.moves).toEqual([]);
	expect(unselected.bodyMoves).toEqual(['zone-a']);
	const multiple = rig({ multiple: true });
	multiple.context.selection.select([zoneA]);
	multiple.tool.pointerDown(pointerAt(500, 500)); multiple.tool.pointerUp(pointerAt(500, 500));
	expect(multiple.moves).toEqual([]);
	expect(multiple.context.selection.selectedIds).toEqual([]);
});
