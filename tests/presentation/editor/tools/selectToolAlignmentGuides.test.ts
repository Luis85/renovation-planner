/**
 * Smart alignment guides in the select tool (spec §6): the drag PREVIEW goes through the same
 * snap as the commit, guides are drawn while the gesture is live and gone when it is not, and
 * the dragged zone is excluded from its own candidates. Its own file because
 * `selectTool.test.ts` is at its line budget.
 */
import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import type { SnapCandidates } from '../../../../src/presentation/editor/snapping/snap-service';
import { ok } from '../../../../src/core/result/Result';
import type { Point } from '../../../../src/core/geometry/Point';
import { flushGesture as flush, pointerAt, toolContext } from '../../../helpers/tool-context';

const square: readonly Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

function rig(snapCandidates: (exclude?: Iterable<string>) => SnapCandidates) {
	setActivePinia(createPinia());
	const gestures: { forward: readonly Point[] }[] = [];
	const excluded: string[][] = [];
	const { context } = toolContext({
		commandDispatcher: { run: () => Promise.resolve(ok('wrote')) },
		snapCandidates: (exclude) => { excluded.push([...(exclude ?? [])]); return snapCandidates(exclude); },
	});
	const tool = new SelectTool({
		spatialObjects: () => [{ id: 'zone-a', points: square }],
		createMoveGesture: (_id, forward) => {
			gestures.push({ forward: forward.points });
			const command: UndoableCommand = { execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) };
			return command;
		},
		reportRejected: () => undefined,
		reportInvalidInput: () => undefined,
	});
	tool.activate(context);
	return { tool, context, gestures, excluded };
}

describe('SelectTool alignment guides', () => {
	it('the body preview is snapped exactly as the commit is, and guides show mid-drag and clear on release', async () => {
		// The alignment exists only when the dragged zone is excluded: a body drag that forgot
		// the exclusion would snap back toward its own original position instead.
		const { tool, context, gestures, excluded } = rig((exclude) => ([...(exclude ?? [])].includes('zone-a') ? { alignments: [{ x: 300, y: 900 }] } : {}));
		tool.pointerDown(pointerAt(10, 10));
		tool.pointerMove(pointerAt(207, 10)); // raw delta +197: right edge at 297, 3 from x=300
		expect(context.renderState.previewPolygon?.[1]).toEqual({ x: 300, y: 0 });
		expect(context.renderState.previewPolygon?.[0]).toEqual({ x: 200, y: 0 });
		expect(context.renderState.snapGuides).toEqual([{ start: { x: 300, y: 0 }, end: { x: 300, y: 900 } }]);
		const previewed = context.renderState.previewPolygon;
		tool.pointerUp(pointerAt(207, 10));
		await flush();
		expect(gestures[0]?.forward).toEqual(previewed);
		expect(context.renderState.snapGuides).toEqual([]);
		expect(excluded.length).toBeGreaterThan(0);
		expect(excluded.every((ids) => ids.includes('zone-a'))).toBe(true);
	});

	it('a vertex drag snaps on preview and commit alike and excludes its own zone', async () => {
		const { tool, context, gestures, excluded } = rig((exclude) => ([...(exclude ?? [])].includes('zone-a') ? { vertices: [{ x: 504, y: 100 }] } : { vertices: [{ x: 100, y: 100 }] }));
		tool.pointerDown(pointerAt(10, 10)); // select first: handles exist only on a selected zone
		tool.pointerUp(pointerAt(10, 10));
		await flush();
		tool.pointerDown(pointerAt(100, 100)); // the (100, 100) vertex handle, index 2
		tool.pointerMove(pointerAt(500, 100));
		expect(context.renderState.previewPolygon?.[2]).toEqual({ x: 504, y: 100 });
		expect(context.renderState.snapGuides).toEqual([{ start: { x: 500, y: 100 }, end: { x: 504, y: 100 } }]);
		tool.pointerUp(pointerAt(500, 100));
		await flush();
		expect(gestures[0]?.forward[2]).toEqual({ x: 504, y: 100 });
		expect(excluded.every((ids) => ids.includes('zone-a'))).toBe(true);
		expect(excluded.length).toBeGreaterThan(0);
	});

	it('cancel, abandonGesture and deactivate clear the guides', () => {
		for (const end of ['cancel', 'abandonGesture', 'deactivate'] as const) {
			const { tool, context } = rig(() => ({ alignments: [{ x: 300, y: 900 }] }));
			tool.pointerDown(pointerAt(10, 10));
			tool.pointerMove(pointerAt(207, 10));
			expect(context.renderState.snapGuides).toHaveLength(1);
			tool[end]();
			expect(context.renderState.snapGuides).toEqual([]);
		}
	});

	it('a click without a drag leaves no guides behind', async () => {
		const { tool, context } = rig(() => ({ vertices: [{ x: 5, y: 0 }] }));
		tool.pointerDown(pointerAt(10, 10));
		// Within the click epsilon, but the move WRITES a guide (corner at (0.2, 0), 4.8 from
		// the candidate) — so the release's own clear is what this case asserts.
		tool.pointerMove(pointerAt(10.2, 10));
		expect(context.renderState.snapGuides).toHaveLength(1);
		tool.pointerUp(pointerAt(10, 10));
		await flush();
		expect(context.renderState.snapGuides).toEqual([]);
	});
});
