import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { screenPoint } from '../../../../src/presentation/editor/viewport/Viewport';
import { DrawPolygonTool } from '../../../../src/presentation/editor/tools/draw-polygon-tool';
import type { EditorContext } from '../../../../src/presentation/editor/tools/editor-context';
import type { UndoableCommand } from '../../../../src/presentation/editor/tools/undoable-command';
import { err, ok } from '../../../../src/core/result/Result';
import type { CreateZoneInput } from '../../../../src/application/commands/zone/CreateZone';
import {
	flushGesture as flush,
	pointerAt as at,
	shiftPointerAt as shiftAt,
	toolContext,
} from '../../../helpers/tool-context';

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

function harness(options: { worldPerScreenPixel?: number } = {}): Harness {
	setActivePinia(createPinia());
	const dispatched: UndoableCommand[] = [];
	const inputs: CreateZoneInput[] = [];
	const rejections: string[] = [];
	let failNext = false;
	// `Promise<void>`, not `void`: `gateNextDispatch` assigns a function that returns the gated
	// promise, and the dispatcher below awaits it through `.then`. The declaration said `void`
	// until `tests/**` was type-checked — wrong about the value it holds, while the runtime was
	// right all along, which is why nothing failed.
	let gate: (() => Promise<void>) | null = null;

	const { context } = toolContext({
		worldPerScreenPixel: options.worldPerScreenPixel,
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
		// The two PLACED vertices and the loose end are separate fields on purpose: only the
		// placed ones are drawn as circles. See `PolygonSketch`.
		expect(h.context.renderState.polygonSketch).toEqual({
			vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
			pointer: { x: 120, y: 90 },
			nextVertex: { x: 120, y: 90 },
		});
		tool.pointerDown(at(0, 100));
		tool.pointerDown(at(0, 0)); // closes
		await flush();

		expect(h.dispatched).toHaveLength(1);
		expect(h.inputs.at(0)?.planId).toBe('plan-1');
		expect(h.inputs.at(0)?.geometry.points).toHaveLength(3);
		expect(h.inputs.at(0)?.name).toBe('Zone 1');
		expect(h.context.selection.selectedIds).toEqual(['zone-created']);
		expect(h.context.renderState.polygonSketch).toBeNull();
	});

	it('clicking the first vertex with fewer than three points does NOT close or dispatch', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(0, 0)); // same spot, buffer of one: nothing to close
		tool.cancel();

		expect(h.dispatched).toHaveLength(0);
		expect(h.context.renderState.polygonSketch).toBeNull();
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
		expect(h.context.renderState.polygonSketch).toBeNull();
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
		expect(h.context.renderState.polygonSketch).toBeNull();

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

		expect(h.context.renderState.polygonSketch).toBeNull();
		// A deactivated tool ignores events until re-activated.
		tool.pointerDown(at(10, 10));
		expect(h.dispatched).toHaveLength(0);

		// A second deactivate (and a cancel after it) is safe: no editor is held any more.
		tool.deactivate();
		tool.cancel();
		expect(h.context.renderState.polygonSketch).toBeNull();
	});

	it('a pointerMove with nothing drawn leaves the preview alone', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerMove(at(50, 50));
		expect(h.context.renderState.polygonSketch).toBeNull();
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
		expect(h.context.renderState.polygonSketch).toBeNull();
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

		expect(context.renderState.polygonSketch?.vertices).toEqual([
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
		expect(h.context.renderState.polygonSketch?.vertices).toEqual([
			{ x: 500, y: 500 },
			{ x: 600, y: 500 },
		]);
		expect(h.context.selection.selectedIds).toEqual([]);
	});
});

/**
 * What the user is shown WHILE drawing, which before this existed was a dashed outline and
 * nothing else: no mark for a click that had landed, and nothing at all to say that clicking
 * the first vertex again is what closes the shape. The gesture could only be learned by being
 * told it.
 *
 * The arming decision lives in the tool rather than in `InteractionLayer` because the layer
 * is `listening: false` by design (SDD §62) and has no camera-converted tolerance of its own;
 * the assertions below are therefore about `RenderState`, which is the seam between them.
 */
describe('DrawPolygonTool: the sketch it broadcasts', () => {
	it('records each placed vertex and drops the loose end until the pointer moves again', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));

		// No loose end yet: the rubber band would be a zero-length edge from the vertex to
		// itself, which draws a stub of a line out of a click that has just landed. The POINTER
		// is recorded, because it really is there — and a third vertex placed within reach of
		// the first should light the close target up at once rather than after a twitch.
		expect(h.context.renderState.polygonSketch).toEqual({
			vertices: [{ x: 0, y: 0 }],
			pointer: { x: 0, y: 0 },
			nextVertex: null,
		});

		tool.pointerMove(at(60, 10));
		expect(h.context.renderState.polygonSketch?.nextVertex).toEqual({ x: 60, y: 10 });

		tool.pointerDown(at(100, 0));
		expect(h.context.renderState.polygonSketch?.nextVertex).toBeNull();
	});

	/**
	 * Where the arming decision LIVES is the subject of `closeTarget.ts` and of the layer's
	 * own suite; what belongs here is that the click the mark promises is judged in the same
	 * screen pixels, through the current camera. A world-fixed tolerance would close at a
	 * fixed number of millimetres and therefore at a different number of PIXELS per zoom.
	 */
	it('judges the close click in screen pixels through the current camera', async () => {
		// Ten world millimetres per screen pixel, so the 12 px tolerance is 120 mm out here.
		const h = harness({ worldPerScreenPixel: 10 });
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(1000, 0));
		tool.pointerDown(at(0, 1000));

		tool.pointerDown(at(130, 0)); // 13 px from the first vertex: a fourth vertex, not a close
		await flush();
		expect(h.dispatched).toHaveLength(0);
		expect(h.context.renderState.polygonSketch?.vertices).toHaveLength(4);

		tool.pointerDown(at(100, 0)); // 10 px away: inside, so this one closes
		await flush();
		expect(h.dispatched).toHaveLength(1);
	});

	it('takes the rubber band down while a close is in flight, leaving the placed vertices', async () => {
		const h = harness();
		const release = h.gateNextDispatch();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		tool.pointerDown(at(0, 100));
		tool.pointerMove(at(1, 1));
		tool.pointerDown(at(0, 0)); // closes; the dispatch is gated open

		// The shape is settled and being written: a loose end still tracking the pointer would
		// be describing a gesture that is over.
		expect(h.context.renderState.polygonSketch).toEqual({
			vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }],
			pointer: null,
			nextVertex: null,
		});
		// And a pointer that keeps moving during that window does not put it back.
		tool.pointerMove(at(40, 40));
		expect(h.context.renderState.polygonSketch?.nextVertex).toBeNull();

		release();
		await flush();
		expect(h.context.renderState.polygonSketch).toBeNull();
	});

	it('leaves the placed vertices on screen when the close is REFUSED', async () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		tool.pointerDown(at(0, 100));
		h.failNextDispatch();
		tool.pointerDown(at(0, 0));
		await flush();

		// The rejection keeps the buffer, so it has to keep the picture of the buffer too —
		// a user whose work survives a refusal but whose drawing vanishes has no way to know
		// that it did.
		expect(h.context.renderState.polygonSketch?.vertices).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 0, y: 100 },
		]);
	});
});

/**
 * Holding Shift draws a straight edge: the next vertex is pulled onto the nearest whole
 * angle from the LAST placed one. The step is `SnapService`'s own (15 degrees as the editor
 * composes it), so this suite asserts the constraint rather than the arithmetic —
 * `snapService.test.ts` owns that.
 *
 * The harness camera is one world millimetre per screen pixel, so world distances here read
 * directly as the pixels the close tolerance is stated in.
 */
describe('DrawPolygonTool: Shift constrains the next vertex', () => {
	it('pulls a nearly-horizontal vertex onto the horizontal', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		// 500 across, 40 down — about 4.6 degrees, well inside the 15 degree step's basin.
		tool.pointerDown(shiftAt(500, 40));

		expect(h.context.renderState.polygonSketch?.vertices.at(1)).toEqual({ x: 500, y: 0 });
	});

	it('leaves the FIRST vertex alone, which has nothing to be straight relative to', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(shiftAt(37, 91));

		// Constraining this against some invented origin would move a point the user placed
		// deliberately — there is no previous vertex, so there is no line to straighten.
		expect(h.context.renderState.polygonSketch?.vertices).toEqual([{ x: 37, y: 91 }]);
	});

	it('previews exactly the point the next click places', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerMove(shiftAt(500, 40));
		const previewed = h.context.renderState.polygonSketch?.nextVertex;

		tool.pointerDown(shiftAt(500, 40));

		// One function answers both, which is the property `SnapService`'s own header claims
		// for snapping generally: the preview can never drift from what gets committed.
		expect(h.context.renderState.polygonSketch?.vertices.at(1)).toEqual(previewed);
	});

	it('keeps the pointer and the landing point as separate facts while constraining', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerMove(shiftAt(500, 40));

		// The hand is at 40 below the axis; the vertex would land on it. The close target is
		// judged from the first of those and the rubber band drawn to the second, which is
		// why one field could not carry both.
		expect(h.context.renderState.polygonSketch?.pointer).toEqual({ x: 500, y: 40 });
		expect(h.context.renderState.polygonSketch?.nextVertex).toEqual({ x: 500, y: 0 });
	});

	/**
	 * Retracing: two vertices down, Shift held, and a click back on the first one — a shape
	 * the user is plainly not trying to make. The constrained point is computed along the
	 * westward ray, which is exactly where the trig used to leave 1.2e-14 mm of dust: enough
	 * to slip past the exact-equality duplicate guard and give the polygon a zero-length edge
	 * that `createPolygon` then accepts, since it validates the count and the finiteness of
	 * the coordinates and a sliver satisfies both.
	 */
	it('refuses a constrained click that lands back on an existing vertex', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(100, 0));
		tool.pointerDown(shiftAt(0, 0));

		expect(h.context.renderState.polygonSketch?.vertices).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
		]);
	});

	/**
	 * The same retrace along a DIAGONAL, which is where the first fix for this did not reach:
	 * `exactOnAxis` restores the axis directions, and at 45 degrees there is no exact value to
	 * restore — `Math.cos` and `Math.sin` of a quarter-pi differ in their last bit, so the
	 * round trip lands at `(0, -1.42e-14)` rather than the origin. The guard is geometric now
	 * rather than bitwise, which is what covers every step direction instead of four of them.
	 */
	it('refuses a constrained retrace along a DIAGONAL, where no exact value exists', () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(shiftAt(100, 100));
		tool.pointerDown(shiftAt(0, 0));

		expect(h.context.renderState.polygonSketch?.vertices).toHaveLength(2);
	});

	it('does not let the constraint decide whether the polygon CLOSES', async () => {
		const h = harness();
		const tool = build(h);
		tool.activate(h.context);

		tool.pointerDown(at(0, 0));
		tool.pointerDown(at(200, 0));
		tool.pointerDown(at(0, 200));
		// From the last vertex (0, 200) this bearing rounds to straight up, so the CONSTRAINED
		// point lands at (0, 4) — four units from the first vertex, well inside the twelve a
		// close takes. The pointer itself is twenty away, so a close would be a lie about
		// where the user is pointing.
		tool.pointerDown(shiftAt(20, 4));
		await flush();

		expect(h.dispatched).toHaveLength(0);
		expect(h.context.renderState.polygonSketch?.vertices).toHaveLength(4);
		expect(h.context.renderState.polygonSketch?.vertices.at(3)?.x).toBeCloseTo(0, 6);
	});
});
