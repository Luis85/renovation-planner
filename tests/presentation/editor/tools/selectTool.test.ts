import { describe, expect, it } from 'vitest';
import type { EditorPointerEvent } from '../../../../src/presentation/editor/tools/editor-tool';
import { createPinia, setActivePinia } from 'pinia';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { ok, err } from '../../../../src/core/result/Result';
import { createPolygon, type Polygon } from '../../../../src/core/geometry/Polygon';
import type { Point } from '../../../../src/core/geometry/Point';
import { flushGesture as flush, pointerAt as eventAt, toolContext } from '../../../helpers/tool-context';

/**
 * Design slice 8 — `SelectTool` (docs/tasks/08-zone-editing.md, "Selecting a zone",
 * "Moving a zone", "Editing a single vertex"): hit-testing resolves overlapping zones by
 * z-order; one drag produces exactly ONE move gesture; a click is a selection and
 * dispatches nothing.
 */

interface Harness {
	context: EditorContext;
	gestures: Array<{ zoneId: string; forward: Polygon; inverse: Polygon }>;
	rejections: string[];
}

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

function harness(worldPerScreenPixel = 1): Harness {
	setActivePinia(createPinia());
	const { context, rejections } = toolContext({
		worldPerScreenPixel,
		commandDispatcher: { run: () => Promise.resolve(ok('wrote')) },
	});
	return { context, gestures: [], rejections };
}

function build(
	h: Harness,
	candidates: Array<{ id: string; points: readonly Point[] }>,
): SelectTool {
	return new SelectTool({
		spatialObjects: () => candidates,
		createMoveGesture: (zoneId, forward, inverse) => {
			h.gestures.push({ zoneId, forward, inverse });
			const gesture: UndoableCommand = {
				execute: () => Promise.resolve(ok('wrote')),
				undo: () => Promise.resolve(ok('wrote')),
			};
			return gesture;
		},
		// Design slice 17 split the door: `reportInvalidInput` is a refusal this tool made
		// itself, before any command existed. Both feed one list here, because every case in
		// this file asks "was the user told", which is true through either.
		reportRejected: (error) => h.rejections.push(error.message),
		reportInvalidInput: (error) => h.rejections.push(error.message),
	});
}

describe('SelectTool', () => {
	it('hit-testing resolves overlapping zones by z-order — the LAST candidate wins', () => {
		const candidates = [
			{ id: 'zone-a', points: squarePoints(0, 0) },
			{ id: 'zone-b', points: squarePoints(50, 0) }, // drawn later, on top, overlapping
		];
		const h = harness();
		const tool = build(h, candidates);

		tool.activate(h.context);
		tool.pointerDown(eventAt(60, 50)); // inside both

		expect(h.context.selection.selectedIds).toEqual(['zone-b']);
	});

	it('clicking empty canvas clears the selection', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);
		tool.pointerDown(eventAt(10, 10));
		expect(h.context.selection.selectedIds).toEqual(['zone-a']);

		tool.pointerUp(eventAt(10, 10)); // a click, not a drag
		tool.pointerDown(eventAt(9999, 9999));

		expect(h.context.selection.selectedIds).toEqual([]);
		expect(h.gestures).toHaveLength(0);
	});

	it('a body drag dispatches exactly ONE gesture regardless of pointermove count', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		for (const step of [20, 30, 40, 50]) {
			tool.pointerMove(eventAt(step, 10));
		}
		// Mid-drag only a preview: no domain command exists yet.
		expect(h.gestures).toHaveLength(0);
		expect(h.context.renderState.previewPolygon).not.toBeNull();

		tool.pointerUp(eventAt(60, 10)); // total delta (+50, 0)

		expect(h.gestures).toHaveLength(1);
		const gesture = h.gestures.at(0);
		if (gesture === undefined) throw new Error('expected the drag gesture');
		expect(gesture.zoneId).toBe('zone-a');
		expect(gesture.forward.points[0]).toEqual({ x: 50, y: 0 });
		expect(gesture.inverse.points[0]).toEqual({ x: 0, y: 0 });
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('the body preview FOLLOWS the pointer mid-drag, rather than merely existing', () => {
		const before = squarePoints(0, 0);
		const h = harness();
		const tool = build(h, [{ id: 'zone-a', points: before }]);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerMove(eventAt(40, 10)); // delta (+30, 0)

		// Asserting the preview is merely non-null — which is all the drag case above does —
		// says that SOMETHING is drawn. A preview stuck at the original coordinates satisfies
		// that while showing the user a ghost that does not move under their hand, and the
		// release would still commit the right polygon. "The zone follows" is this assertion
		// and nothing else: the ghost is at the pointer, on every move, not just at the end.
		expect(h.context.renderState.previewPolygon?.[0]).toEqual({ x: 30, y: 0 });
		expect(h.context.renderState.previewPolygon?.[2]).toEqual({ x: 130, y: 100 });

		tool.pointerMove(eventAt(50, 10));
		expect(h.context.renderState.previewPolygon?.[0]).toEqual({ x: 40, y: 0 });
	});

	it('a near-zero pointerUp is a pure selection — no command, no history entry', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerMove(eventAt(10.2, 10)); // within CLICK_EPSILON of start
		tool.pointerUp(eventAt(10.2, 10));

		expect(h.gestures).toHaveLength(0);
		expect(h.context.selection.selectedIds).toEqual(['zone-a']);
	});

	it('dragging a vertex replaces exactly that index and keeps every other vertex', () => {
		const before = squarePoints(0, 0);
		const candidates = [{ id: 'zone-a', points: before }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		// Select first...
		tool.pointerDown(eventAt(10, 10));
		tool.pointerUp(eventAt(10, 10));
		expect(h.context.selection.selectedIds).toEqual(['zone-a']);

		// ...then grab vertex 1 at (100, 0): screen identity, so its projection is (100, 0).
		tool.pointerDown(eventAt(100, 2));
		tool.pointerMove(eventAt(150, 40));
		expect(h.gestures).toHaveLength(0); // preview only mid-gesture
		tool.pointerUp(eventAt(150, 40));

		expect(h.gestures).toHaveLength(1);
		const gesture = h.gestures.at(0);
		if (gesture === undefined) throw new Error('expected the vertex gesture');
		expect(gesture.zoneId).toBe('zone-a');
		expect(gesture.forward.points[0]).toEqual(before[0]);
		expect(gesture.forward.points[1]).toEqual({ x: 150, y: 40 });
		expect(gesture.forward.points[2]).toEqual(before[2]);
		expect(gesture.forward.points[3]).toEqual(before[3]);
		// The inverse is the whole pre-drag list.
		expect(gesture.inverse.points).toEqual([...before]);
	});

	it('deactivate clears any transient preview and detaches', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerMove(eventAt(50, 50));
		expect(h.context.renderState.previewPolygon).not.toBeNull();

		tool.deactivate();
		expect(h.context.renderState.previewPolygon).toBeNull();

		// A second detach (or any lifecycle call after it) is safe: the tool holds no
		// editor to talk to any more.
		tool.deactivate();
		tool.cancel();
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('deactivate clears a predicted hover too, not just the drag preview', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerMove(eventAt(50, 50)); // hovering the body, nothing pressed
		expect(h.context.renderState.hoveredObjectId).toBe('zone-a');
		expect(h.context.renderState.hoveredTargetKind).toBe('body');

		tool.deactivate();
		expect(h.context.renderState.hoveredObjectId).toBeNull();
		// The KIND is cleared with the id at every site that writes one — two fields, one
		// fact, so the cursor cannot outlive the hover it was derived from.
		expect(h.context.renderState.hoveredTargetKind).toBeNull();
	});

	it('a hover with no gesture predicts the same target a click there would take', () => {
		// This is `resolveSelectionTarget` asked by `pointerMove` rather than by `pointerDown` —
		// the same question, so the cursor's promise and the click's outcome cannot disagree.
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerMove(eventAt(50, 50)); // inside the body, nothing pressed
		expect(h.context.renderState.hoveredObjectId).toBe('zone-a');

		tool.pointerMove(eventAt(9999, 9999)); // off every body
		expect(h.context.renderState.hoveredObjectId).toBeNull();
	});

	it('starting a gesture clears the predicted hover, since the pointer is no longer merely looking', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerMove(eventAt(50, 50));
		expect(h.context.renderState.hoveredObjectId).toBe('zone-a');
		expect(h.context.renderState.hoveredTargetKind).toBe('body');

		tool.pointerDown(eventAt(50, 50));
		expect(h.context.renderState.hoveredObjectId).toBeNull();
		expect(h.context.renderState.hoveredTargetKind).toBeNull();
	});

	it('a selection naming an object the candidate list no longer has just does nothing', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		// Selection names a zone the CURRENT candidate list lacks (deleted elsewhere).
		h.context.selection.select(['zone-gone' as never]);
		tool.pointerDown(eventAt(199, 199));

		expect(h.gestures).toHaveLength(0);
	});

	it('cancel abandons an in-flight gesture: no dispatch, preview cleared', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerMove(eventAt(50, 50));
		tool.cancel();

		expect(h.gestures).toHaveLength(0);
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('a pointerup arriving AFTER its gesture was cancelled is ignored, not committed', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerMove(eventAt(50, 50));
		tool.cancel();

		// The release of an abandoned drag belongs to nothing.
		tool.pointerUp(eventAt(60, 60));

		expect(h.gestures).toHaveLength(0);
		expect(h.context.renderState.previewPolygon).toBeNull();
		expect(h.context.selection.selectedIds).toEqual(['zone-a']);
	});

	it('a pointerup after deactivation belongs to no editor', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);
		tool.deactivate();

		tool.pointerUp(eventAt(10, 10));

		expect(h.gestures).toHaveLength(0);
	});

	it('ignores non-primary buttons, and events before activation', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);

		// Before activate(): the event belongs to no editor.
		tool.pointerDown(eventAt(200, 200));
		expect(h.context.selection.selectedIds).toEqual([]);

		tool.activate(h.context);
		const secondary: EditorPointerEvent = {
			...eventAt(200, 200),
			button: 'secondary',
		};
		tool.pointerDown(secondary);
		expect(h.context.selection.selectedIds).toEqual([]);
	});

	it('a pointerMove with no in-flight gesture does nothing', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerMove(eventAt(50, 50));
		expect(h.gestures).toHaveLength(0);
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('a validation rejection on release dispatches nothing and clears the preview', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		// Select, then grab vertex 2 at (100, 100) and drag it to a NON-FINITE position:
		// createPolygon must reject and the gesture must die before any command exists.
		tool.pointerDown(eventAt(10, 10));
		tool.pointerUp(eventAt(10, 10));
		tool.pointerDown(eventAt(101, 101));
		tool.pointerUp({
			worldPoint: { x: Number.NaN, y: Number.NaN },
			screenPoint: screenPoint(250, 250),
			button: 'primary',
			modifiers: { shift: false, ctrl: false, alt: false },
			targetId: null,
		});

		expect(h.gestures).toHaveLength(0);
		expect(h.context.renderState.previewPolygon).toBeNull();
		expect(h.rejections).toHaveLength(1);
	});

	it('a FAILED move dispatch reports through the rejection seam too', async () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		// This harness's dispatcher resolves a failed Result: the wrapped command ran and
		// was refused.
		h.context.commandDispatcher.run = () =>
			Promise.resolve(err({ category: 'Persistence', code: 'test.injected-failure', message: 'injected' }));
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerUp(eventAt(10, 10));
		tool.pointerDown(eventAt(10, 10));
		tool.pointerMove(eventAt(60, 10));
		tool.pointerUp(eventAt(60, 10));
		await flush();

		expect(h.gestures).toHaveLength(1); // the gesture was BUILT and dispatched
		expect(h.rejections).toHaveLength(1); // and its failure surfaced
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('a click is camera-scaled: sub-pixel-per-millimetre jitter at high zoom stays a click', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		// 10 world millimetres per screen pixel — ten times coarser than the default
		// camera. A world-fixed 0.5 mm epsilon would call a 1 px hand jitter a move.
		const h = harness(10);
		const tool = build(h, candidates);
		tool.activate(h.context);

		// 30 world mm of displacement = 3 px at this camera: inside the 4 px epsilon.
		tool.pointerDown(eventAt(10, 10));
		tool.pointerUp(eventAt(40, 10));

		expect(h.gestures).toHaveLength(0);
		expect(h.context.selection.selectedIds).toEqual(['zone-a']);
	});
	it('a CLICK on a vertex handle moves nothing and adds no history entry', () => {
		// The click-versus-drag epsilon used to live only in the body branch, so a plain
		// click within the grab radius of a vertex teleported that vertex to the click point
		// and pushed a real move onto the undo stack. At the default camera the grab radius
		// is 80 world millimetres, so "within the handle" is a long way from "on the vertex".
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness(10); // 10 world mm per screen pixel — the default camera
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10)); // select the zone so its handles show
		tool.pointerUp(eventAt(10, 10));
		expect(h.context.selection.selectedIds).toEqual(['zone-a']);

		// Down and up at the SAME point, 20 world mm (2 px) off the corner at (100, 0) —
		// inside the 8 px grab radius, so this is unambiguously a vertex gesture.
		tool.pointerDown(eventAt(100, 20));
		tool.pointerUp(eventAt(100, 20));

		expect(h.gestures).toHaveLength(0);
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('a NON-PRIMARY release during a drag does not commit the move', () => {
		// A mouse shares one pointerId across its buttons, so a reflexive right-click
		// mid-drag delivers a secondary pointerup. It never started this gesture and must
		// not end it: committing there wrote the zone at a half-finished position and left
		// the real release a silent no-op.
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerMove(eventAt(60, 10));
		tool.pointerUp(eventAt(60, 10, 'secondary'));

		expect(h.gestures).toHaveLength(0);

		// The gesture is still live, so the real release still commits it.
		tool.pointerUp(eventAt(60, 10));
		expect(h.gestures).toHaveLength(1);
		expect(h.gestures[0].forward.points[0]).toEqual({ x: 50, y: 0 });
	});

	it('a body move is a RIGID translation even when the snap moves the anchor', () => {
		// The snap used to be applied to every vertex INDEPENDENTLY, which is not a
		// translation: with live candidates one corner lands on a guide while the opposite
		// corner stays put, so a "move" silently changes the zone's shape and area. One snap
		// of the anchor, that correction applied to every point.
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		setActivePinia(createPinia());
		const { context, rejections } = toolContext({
			commandDispatcher: { run: () => Promise.resolve(ok('wrote')) },
			// A grid that only ever pulls the first vertex — the pathological case an
			// independent per-vertex snap deforms and a delta snap does not.
			snapPoint: (point) => (point.x === 50 && point.y === 0 ? { x: 40, y: 0 } : point),
		});
		const h: Harness = { context, gestures: [], rejections };
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.pointerUp(eventAt(60, 10)); // delta (+50, 0); anchor lands on (50, 0) and snaps to (40, 0)

		expect(h.gestures).toHaveLength(1);
		// Every point moved by the SAME corrected delta (+40, 0): still a 100 x 100 square.
		expect(h.gestures[0].forward.points).toEqual([
			{ x: 40, y: 0 },
			{ x: 140, y: 0 },
			{ x: 140, y: 100 },
			{ x: 40, y: 100 },
		]);
	});
});

describe('SelectTool.hasDraft', () => {
	// Task 9 — Escape asks a tool whether it holds work `cancel()` would discard before
	// deciding whether to switch away or clear a selection instead.
	it('is false before any press, true for a drag in flight, and false again after it commits', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		expect(tool.hasDraft()).toBe(false);

		tool.pointerDown(eventAt(10, 10));
		expect(tool.hasDraft()).toBe(true);

		tool.pointerUp(eventAt(60, 10)); // a real drag, dispatched
		expect(tool.hasDraft()).toBe(false);
	});

	it('is false again once cancel() or abandonGesture() discards the drag', () => {
		const candidates = [{ id: 'zone-a', points: squarePoints(0, 0) }];
		const h = harness();
		const tool = build(h, candidates);
		tool.activate(h.context);

		tool.pointerDown(eventAt(10, 10));
		tool.cancel();
		expect(tool.hasDraft()).toBe(false);

		tool.pointerDown(eventAt(10, 10));
		tool.abandonGesture();
		expect(tool.hasDraft()).toBe(false);
	});
});
