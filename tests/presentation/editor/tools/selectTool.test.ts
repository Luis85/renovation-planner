import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { SelectTool } from '../../../../src/presentation/editor/tools/select-tool';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import type { EditorPointerEvent } from '../../../../src/presentation/editor/tools/editor-tool';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { RenderState } from '../../../../src/presentation/editor/tools/render-state';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';
import { ok, err } from '../../../../src/core/result/Result';
import { createPolygon, type Polygon } from '../../../../src/core/geometry/Polygon';
import type { Point } from '../../../../src/core/geometry/Point';

/**
 * Design slice 8 — `SelectTool` (docs/tasks/08-zone-editing.md, "Selecting a zone",
 * "Moving a zone", "Editing a single vertex"): hit-testing resolves overlapping zones by
 * z-order; one drag produces exactly ONE move gesture; a click is a selection and
 * dispatches nothing.
 */

interface Harness {
	context: EditorContext;
	gestures: Array<{ zoneId: string; forward: Polygon; inverse: Polygon }>;
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

function harness(): Harness {
	setActivePinia(createPinia());
	const gestures: Harness['gestures'] = [];
	const rejections: string[] = [];

	const selection = {
		selectedIds: [] as string[],
		select(ids: readonly string[]) {
			this.selectedIds = [...ids];
		},
		clear() {
			this.selectedIds = [];
		},
		isSelected(id: string) {
			return this.selectedIds.includes(id);
		},
	};
	const context: EditorContext = {
		viewport: {
			worldToScreen: (point) => point as never,
			screenToWorld: (point) => point as never,
			setPan: () => undefined,
			setZoom: () => undefined,
		},
		selection,
		snapService: { snapPoint: (point) => point } as never,
		commandDispatcher: {
			run: () => Promise.resolve(ok(undefined)),
		},
		writeLedger: {} as never,
		renderState: new RenderState(),
		activePlan: { id: 'plan-1' as never, calibration: null },
	};

	return { context, gestures, rejections };
}

/** Drains the gesture's microtask chain before its dispatch result is asserted. */
async function flush(): Promise<void> {
	for (let round = 0; round < 8; round++) await Promise.resolve();
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
				execute: () => Promise.resolve(ok(undefined)),
				undo: () => Promise.resolve(ok(undefined)),
			};
			return gesture;
		},
		reportRejected: (error) => h.rejections.push(error.message),
	});
}

function eventAt(worldX: number, worldY: number): EditorPointerEvent {
	return {
		worldPoint: { x: worldX, y: worldY },
		screenPoint: screenPoint(worldX, worldY),
		button: 'primary',
		modifiers: { shift: false, ctrl: false, alt: false },
		targetId: null,
	};
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
		const h = harness();
		// 10 world millimetres per screen pixel — ten times coarser than the default
		// camera. A world-fixed 0.5 mm epsilon would call a 1 px hand jitter a move.
		h.context.viewport.screenToWorld = ((point: { x: number; y: number }) => ({
			x: point.x * 10,
			y: point.y * 10,
		})) as never;
		const tool = build(h, candidates);
		tool.activate(h.context);

		// 30 world mm of displacement = 3 px at this camera: inside the 4 px epsilon.
		tool.pointerDown(eventAt(10, 10));
		tool.pointerUp(eventAt(40, 10));

		expect(h.gestures).toHaveLength(0);
		expect(h.context.selection.selectedIds).toEqual(['zone-a']);
	});
});
