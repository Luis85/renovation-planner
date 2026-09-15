import { expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool, type SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import { itemTransformBox } from '../../../../src/presentation/editor/elements/transformBox';
import { cursorClassFor } from '../../../../src/presentation/editor/surface/cursor';
import type { SpatialElement } from '../../../../src/domain/spatial/SpatialElement';
import type { EntityId } from '../../../../src/core/identity/EntityId';
import { ok } from '../../../../src/core/result/Result';
import { pointerAt, toolContext } from '../../../helpers/tool-context';

const item: SpatialElement = { id: 'element-cabinet', kind: 'object', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }] };
const wider = [{ x: 0, y: 0 }, { x: 1500, y: 0 }, { x: 1500, y: 1000 }, { x: 0, y: 1000 }];

function rig(overrides: Partial<SelectToolDeps> = {}) {
	setActivePinia(createPinia());
	const { context } = toolContext();
	const commitResize = vi.fn<NonNullable<SelectToolDeps['commitResize']>>(), previewResize = vi.fn<NonNullable<SelectToolDeps['previewResize']>>(), moveElement = vi.fn<NonNullable<SelectToolDeps['moveElement']>>();
	const tool = new SelectTool({
		spatialObjects: () => [item],
		createMoveGesture: () => ({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) }),
		reportRejected: () => {},
		reportInvalidInput: () => {},
		transformBox: () => itemTransformBox(item), commitResize, previewResize, moveElement,
		...overrides,
	});
	tool.activate(context);
	context.selection.select([item.id as EntityId<string>]);
	return { tool, context, commitResize, previewResize, moveElement };
}

it('predicts a transform box handle on hover with the grab cursor, then resizes from it instead of moving the item', () => {
	const { tool, context, commitResize, moveElement } = rig();
	tool.pointerMove(pointerAt(1012, 512));
	expect(context.renderState.hoveredTargetKind).toBe('resize');
	expect(cursorClassFor({ activeToolId: 'select', panPhase: 'idle', hoveredObjectId: item.id, hoveredTargetKind: 'resize' })).toBe('rp-plan-canvas-grab');
	tool.pointerDown(pointerAt(1012, 512));
	expect(tool.hasDraft()).toBe(true);
	tool.pointerMove(pointerAt(1512, 1012)); tool.pointerUp(pointerAt(1512, 1012));
	expect(commitResize).toHaveBeenCalledExactlyOnceWith(item.id, { points: wider }, item);
	expect(moveElement).not.toHaveBeenCalled();
});

it('abandons a resize on cancel and offers no handles when the facade answers no box', () => {
	const { tool, commitResize, previewResize } = rig();
	tool.pointerDown(pointerAt(1012, 512)); tool.pointerMove(pointerAt(1512, 1012));
	expect(tool.cancelGeometryGesture()).toBe(true);
	expect(previewResize).toHaveBeenLastCalledWith(null);
	tool.pointerUp(pointerAt(1512, 1012));
	expect(commitResize).not.toHaveBeenCalled();
	const none = rig({ transformBox: () => null });
	none.tool.pointerMove(pointerAt(1012, 512));
	expect(none.context.renderState.hoveredTargetKind).toBeNull();
});

it('drags a sized placement by its body, keeping the original candidate’s size (regression: a resized placement must stay draggable)', () => {
	// `hitPoints` mirrors what `structureCandidates.ts` derives for a real asset candidate
	// (`elementFootprint`, via `derivedFootprintKind`) — an asset hit-tests by its derived
	// footprint, not its raw `points`, so a body click needs one here too.
	const placement: SpatialElement & { hitPoints: typeof item.points } = { id: 'element-sofa', kind: 'asset', assetId: 'asset-sofa', points: item.points, hitPoints: item.points, size: { width: 1600, depth: 900 } };
	const { tool, moveElement } = rig({ spatialObjects: () => [placement] });
	// Body centre, away from every transform-box handle: a body drag, not a resize.
	tool.pointerDown(pointerAt(500, 250));
	tool.pointerMove(pointerAt(600, 350));
	tool.pointerUp(pointerAt(600, 350));
	expect(moveElement).toHaveBeenCalledOnce();
	const original = moveElement.mock.calls[0]?.[2];
	expect(original).toMatchObject({ size: { width: 1600, depth: 900 } });
});
