import { describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool, type SpatialObjectCandidate, type SelectToolDeps } from '../../../../src/presentation/editor/tools/select-tool';
import { canvasCandidates } from '../../../../src/presentation/editor/selection/canvasCandidates';
import { EMPTY_STRUCTURE } from '../../../../src/domain/spatial/Structure';
import { createPolygon } from '../../../../src/core/geometry/Polygon';
import type { Point } from '../../../../src/core/geometry/Point';
import { pointerAt, toolContext } from '../../../helpers/tool-context';
import { ok } from '../../../../src/core/result/Result';

/**
 * Follow-up B1, Z3 (spec §3.10 row 2): `canvasCandidates.test.ts` proves the filter in
 * isolation and `zoneLock.e2e.test.ts` proves the full mounted editor's hit list shrinks —
 * neither drives the real `SelectTool` against a locked/unlocked pair the way a click, a
 * hover or a marquee actually would. This file wires the real `SelectTool` to the real
 * `canvasCandidates` (the same adapter `registerEditorTools.ts` uses), fed by fixture zones
 * rather than a hand-picked candidate list, so click-through is proven through the tool's own
 * hit-testing rather than only through the filter it happens to call.
 */

function squarePoints(x: number, y: number): readonly Point[] {
	const result = createPolygon([
		{ x, y },
		{ x: x + 100, y },
		{ x: x + 100, y: y + 100 },
		{ x, y: y + 100 },
	]);
	if (!result.ok) throw new Error(`fixture polygon invalid: ${result.error.message}`);
	return result.value.points;
}

// Overlapping in the (50,50)-(100,100) corner, so a click or a hover THERE is inside both.
const LOCKED_ZONE = { id: 'zone-locked', points: squarePoints(0, 0), locked: true as const };
const UNLOCKED_ZONE = { id: 'zone-unlocked', points: squarePoints(50, 50) };

function build(): { tool: SelectTool; context: ReturnType<typeof toolContext>['context']; gestures: unknown[] } {
	const zones = [LOCKED_ZONE, UNLOCKED_ZONE];
	const { context } = toolContext();
	const gestures: unknown[] = [];
	const deps: SelectToolDeps = {
		spatialObjects: (): readonly SpatialObjectCandidate[] =>
			canvasCandidates(zones, EMPTY_STRUCTURE, { zone: true, architecture: true }),
		createMoveGesture: (zoneId, forward, inverse) => {
			gestures.push({ zoneId, forward, inverse });
			return { execute: () => Promise.resolve(ok('wrote' as const)), undo: () => Promise.resolve(ok('wrote' as const)) };
		},
		reportRejected: vi.fn<SelectToolDeps['reportRejected']>(),
		reportInvalidInput: vi.fn<SelectToolDeps['reportInvalidInput']>(),
	};
	const tool = new SelectTool(deps);
	tool.activate(context);
	return { tool, context, gestures };
}

describe('SelectTool click-through over a locked zone (real SelectTool, real canvasCandidates)', () => {
	it('a click inside a locked zone that also lies inside an unlocked zone selects the unlocked zone', () => {
		setActivePinia(createPinia());
		const { tool, context } = build();

		tool.pointerDown(pointerAt(75, 75)); // inside both LOCKED_ZONE and UNLOCKED_ZONE
		tool.pointerUp(pointerAt(75, 75));

		expect(context.selection.selectedIds).toEqual(['zone-unlocked']);
	});

	it('a click inside a locked zone where nothing else is there clears the selection', () => {
		setActivePinia(createPinia());
		const { tool, context } = build();

		tool.pointerDown(pointerAt(125, 125)); // inside UNLOCKED_ZONE only
		tool.pointerUp(pointerAt(125, 125));
		expect(context.selection.selectedIds).toEqual(['zone-unlocked']);

		tool.pointerDown(pointerAt(10, 10)); // inside LOCKED_ZONE only — locked, not click-through-able
		expect(context.selection.selectedIds).toEqual([]);
	});

	it('hovering the locked-only area reports no hovered id', () => {
		setActivePinia(createPinia());
		const { tool, context } = build();

		tool.pointerMove(pointerAt(10, 10)); // inside LOCKED_ZONE only

		expect(context.renderState.hoveredObjectId).toBeNull();
		expect(context.renderState.hoveredTargetKind).toBeNull();
	});

	it('a marquee fully enclosing a locked zone and an unlocked zone selects only the unlocked one', () => {
		setActivePinia(createPinia());
		const { tool, context, gestures } = build();

		tool.pointerDown(pointerAt(-10, -10)); // outside both, above/left of the locked zone's corner
		tool.pointerMove(pointerAt(160, 160)); // encloses both squares (0,0)-(100,100) and (50,50)-(150,150)
		tool.pointerUp(pointerAt(160, 160));

		expect(context.selection.selectedIds).toEqual(['zone-unlocked']);
		expect(gestures).toHaveLength(0);
	});
});
