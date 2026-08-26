import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';
import { DrawPolygonTool } from '../../../../src/presentation/editor/tools/draw-polygon-tool';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { err, ok } from '../../../../src/core/result/Result';
import type { CreateZoneInput } from '../../../../src/application/commands/zone/CreateZone';
import { flushGesture as flush, pointerAt as at, toolContext } from '../../../helpers/tool-context';

/**
 * Design slice 8 — `DrawPolygonTool` driven by simulated pointer sequences
 * (docs/tasks/08-zone-editing.md, "Component tests"): expected vertex buffer, exactly ONE
 * dispatched command per closed polygon, buffer preserved across a rejected close.
 */

interface Harness {
	context: EditorContext;
	dispatched: UndoableCommand[];
	inputs: CreateZoneInput[];
	rejections: string[];
	failNextDispatch: () => void;
	gateNextDispatch: () => () => void;
	nextZoneName: string;
}

function harness(): Harness {
	setActivePinia(createPinia());
	const dispatched: UndoableCommand[] = [];
	const inputs: CreateZoneInput[] = [];
	const rejections: string[] = [];
	let failNext = false;
	let gate: (() => void) | null = null;

	const { context } = toolContext({
		commandDispatcher: {
			run: (runnable) => {
				if (gate !== null) {
					const release = gate;
					gate = null;
					return release().then(() => {
						dispatched.push(runnable);
						return runnable.execute();
					});
				}
				if (failNext) {
					failNext = false;
					return Promise.resolve(
						err({ category: 'Persistence', code: 'test.injected-failure', message: 'injected' }),
					);
				}
				dispatched.push(runnable);
				return runnable.execute();
			},
		},
	});

	return {
		context,
		dispatched,
		inputs,
		rejections,
			failNextDispatch: () => {
				failNext = true;
			},
			gateNextDispatch: () => {
				let release!: () => void;
				const gated = new Promise<void>((resolve) => {
					release = resolve;
				});
				gate = () => {
					gate = null;
					return gated;
				};
				return () => release();
			},
		get nextZoneName() {
			return `Zone ${inputs.length + 1}`;
		},
	};
}

function build(h: Harness): DrawPolygonTool {
	return new DrawPolygonTool({
		createCommand: (input) => {
			h.inputs.push(input);
			return {
				execute: () => Promise.resolve(ok(undefined)),
				undo: () => Promise.resolve(ok(undefined)),
				get createdZoneId() {
					return 'zone-created' as never;
				},
			} as never;
		},
		nextZoneName: () => h.nextZoneName,
		reportRejected: (error) => h.rejections.push(error.message),
	});
}


describe('DrawPolygonTool', () => {
	it('three vertices plus a close click produce exactly ONE dispatched command and a selection', async () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		tool.pointerMove(at(120, 90)); // rubber-band while drawing
		expect(h.context.renderState.previewPolygon).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 120, y: 90 },
		]);
		tool.pointerDown(at(0, 100));
		tool.pointerDown(at(0, 0)); // closes
		await flush();

		expect(h.dispatched).toHaveLength(1);
		expect(h.inputs.at(0)?.planId).toBe('plan-1');
		expect(h.inputs.at(0)?.geometry.points).toHaveLength(3);
		expect(h.inputs.at(0)?.name).toBe('Zone 1');
		expect(h.context.selection.selectedIds).toEqual(['zone-created']);
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('clicking the first vertex with fewer than three points does NOT close or dispatch', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(0, 0)); // same spot, buffer of one: nothing to close
		tool.cancel();

		expect(h.dispatched).toHaveLength(0);
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('a FAILED dispatch reports and keeps the buffer — the user keeps their work', async () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		tool.pointerDown(at(0, 100));
		h.failNextDispatch();
		tool.pointerDown(at(0, 0)); // close attempt against a failing write
		await flush();

		expect(h.rejections).toHaveLength(1);
		expect(h.context.selection.selectedIds).toEqual([]);
		// Buffer intact: cancelling now is deliberate, not forced by the rejection.
		tool.cancel();
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('a close click while ANOTHER close is in flight is ignored — one shape, one command', async () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		tool.pointerDown(at(0, 100));

		// First close click: the dispatch is held open by the gate.
		const release = h.gateNextDispatch();
		tool.pointerDown(at(0, 0));
		// Second close click inside the in-flight window — against the SAME buffer.
		tool.pointerDown(at(0, 0));
		release();
		await flush();

		expect(h.dispatched).toHaveLength(1);
		expect(h.inputs).toHaveLength(1);
		expect(h.context.selection.selectedIds).toEqual(['zone-created']);
	});

	it('a close click while ANOTHER close is in flight is ignored even when it FAILS', async () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		tool.pointerDown(at(0, 100));
		h.failNextDispatch();
		tool.pointerDown(at(0, 0)); // closes, fails, buffer kept, closing cleared
		await flush();
		expect(h.rejections).toHaveLength(1);

		// The guard is released by the failure: a fresh close is possible again.
		tool.pointerDown(at(0, 0));
		await flush();
		expect(h.dispatched).toHaveLength(1);
	});

	it('cancel discards the buffer without dispatching anything', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerMove(at(50, 50));
		tool.cancel();

		expect(h.dispatched).toHaveLength(0);
		expect(h.context.renderState.previewPolygon).toBeNull();

		// After cancel, a fresh draw starts from an empty buffer.
		tool.pointerDown(at(500, 500));
		tool.cancel();
		expect(h.dispatched).toHaveLength(0);
	});

	it('deactivate clears the preview too', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerMove(at(50, 50));
		tool.deactivate();

		expect(h.context.renderState.previewPolygon).toBeNull();
		// A deactivated tool ignores events until re-activated.
		tool.pointerDown(at(10, 10));
		expect(h.dispatched).toHaveLength(0);

		// A second deactivate (and a cancel after it) is safe: no editor is held any more.
		tool.deactivate();
		tool.cancel();
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('a pointerMove with nothing drawn leaves the preview alone', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerMove(at(50, 50));
		expect(h.context.renderState.previewPolygon).toBeNull();
	});

	it('a close attempt with a non-finite vertex is rejected BEFORE any command exists', async () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		// First vertex valid, second non-finite (a degenerate worldPoint), third valid;
		// closing then fails createPolygon's finite-coordinate rule.
		tool.pointerDown(at(0, 0));
		tool.pointerDown({
			worldPoint: { x: Number.NaN, y: 0 },
			screenPoint: screenPoint(100, 0),
			button: 'primary',
			modifiers: { shift: false, ctrl: false, alt: false },
			targetId: null,
		});
		tool.pointerDown(at(0, 100));
		tool.pointerDown(at(0, 0)); // close click on the first vertex
		await flush();

		expect(h.dispatched).toHaveLength(0);
		expect(h.rejections).toHaveLength(1);
		// Buffer intact — the user keeps their work and can cancel deliberately.
		tool.cancel();
		expect(h.context.renderState.previewPolygon).toBeNull();
	});
	it('a snapped vertex landing on an existing one is NOT pushed as a duplicate', async () => {
		// The close test measures the RAW click and the buffer takes the SNAPPED one, so a
		// snap that pulls a near-miss exactly onto an existing vertex fails the close test.
		// Pushing it anyway gives the polygon a repeated point — a zero-length edge that
		// `Polygon` forbids and that area, centroid and hit-testing all divide through.
		setActivePinia(createPinia());
		const inputs: CreateZoneInput[] = [];
		const { context } = toolContext({
			// Everything within 5 mm of (0, 0) snaps onto it.
			snapPoint: (point) => (Math.hypot(point.x, point.y) <= 5 ? { x: 0, y: 0 } : point),
		});
		const tool = new DrawPolygonTool({
			createCommand: (input) => {
				inputs.push(input);
				return {
					execute: () => Promise.resolve(ok(undefined)),
					undo: () => Promise.resolve(ok(undefined)),
					get createdZoneId() {
						return 'zone-created' as never;
					},
				} as never;
			},
			nextZoneName: () => 'Zone 1',
			reportRejected: () => undefined,
		});
		tool.activate(context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		// Three world millimetres from the first vertex: far outside the 12 px close
		// tolerance is not the question — with fewer than three points it cannot close at
		// all — but the snap lands it exactly on `buffer[0]`.
		tool.pointerDown(at(3, 0));

		expect(context.renderState.previewPolygon).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
		]);
		await flush();
	});

	it('Escape during an in-flight close does not let the LATE success wipe the next polygon', async () => {
		// `cancel()` clears `closing`, so clicks are accepted again while the dispatch is
		// still in flight. Without a generation counter the resolved continuation then ran
		// unconditionally: it wiped the new gesture's vertices, blanked its rubber band and
		// selected the zone the user had just cancelled out of.
		const h = harness();
		const release = h.gateNextDispatch();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		tool.pointerDown(at(100, 100));
		tool.pointerDown(at(0, 0)); // close — now awaiting the gated dispatch

		tool.cancel();
		tool.pointerDown(at(500, 500));
		tool.pointerDown(at(600, 500));

		release();
		await flush();

		// The new gesture's two vertices survived, and nothing selected the zone the
		// abandoned close created.
		expect(h.context.renderState.previewPolygon).toEqual([
			{ x: 500, y: 500 },
			{ x: 600, y: 500 },
		]);
		expect(h.context.selection.selectedIds).toEqual([]);
	});
});
