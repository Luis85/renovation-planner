import { describe, expect, it } from 'vitest';
import { CalibrateTool } from '../../../../src/presentation/editor/tools/calibrate-tool';
import { at, click, flush, harness, newTool, shiftAt } from '../../../helpers/calibrateHarness';

/**
 * The calibration segment on the canvas (`RenderState.measurement`, `InteractionLayer`).
 *
 * Added because a vault walkthrough found the gesture drew NOTHING: two clicks, then a
 * dialog, with no indication of which two points the plugin thought had been picked. Every
 * automated check passed — `pointerMove` was an empty method under a comment saying a
 * rendering seam did not exist yet, and an empty method has no behaviour for a test to
 * disagree with. This is the class of defect the manual suite exists for.
 */
describe('the calibration segment it draws', () => {
	it('marks the first point as soon as it is placed, before the pointer moves', () => {
		const h = harness();
		const tool = newTool(h);

		click(tool, at(100, 200));

		// Zero length on purpose: the two endpoint markers are what make the anchor visible,
		// and a segment is the one shape that can carry them.
		expect(h.context.renderState.measurement).toEqual({
			start: { x: 100, y: 200 },
			end: { x: 100, y: 200 },
		});
	});

	it('rubber-bands from the anchor to the pointer', () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(0, 0));

		tool.pointerMove(at(400, 0));

		expect(h.context.renderState.measurement).toEqual({
			start: { x: 0, y: 0 },
			end: { x: 400, y: 0 },
		});

		tool.pointerMove(at(400, 300));

		expect(h.context.renderState.measurement).toEqual({
			start: { x: 0, y: 0 },
			end: { x: 400, y: 300 },
		});
	});

	it('draws nothing on a pointer that moves before any point is placed', () => {
		const h = harness();
		const tool = newTool(h);

		tool.pointerMove(at(400, 300));

		expect(h.context.renderState.measurement).toBeNull();
	});

	it('a pointerMove before activate() draws nothing rather than throwing', () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			planId: h.planId,
		createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
			reportRejected: h.reportRejected,
			// Slice 17 split this door from `reportRejected` — a refusal this tool makes before
			// building a command, which no dispatcher ever sees. Both literals here omitted it.
			reportInvalidInput: h.reportInvalidInput,
		});

		expect(() => tool.pointerMove(at(10, 10))).not.toThrow();
		expect(h.context.renderState.measurement).toBeNull();
	});

	/**
	 * The measured segment has to survive the dialogs — it is the thing the user is being
	 * asked to put a length on. Held open with a supplier that never resolves, so the
	 * assertion happens while the prompt is genuinely outstanding.
	 */
	it('keeps the measured segment on screen while the prompt is open', async () => {
		const h = harness();
		const tool = newTool(h, () => new Promise<number | null>(() => {
			/* deliberately never settles: the prompt stays open */
		}));
		click(tool, at(0, 0));

		click(tool, at(800, 0));
		await flush();

		expect(h.context.renderState.measurement).toEqual({
			start: { x: 0, y: 0 },
			end: { x: 800, y: 0 },
		});
	});

	/**
	 * And must not follow the pointer while it sits there. `pointA` is already `null` by
	 * then, so this drives the `prompting` half of `pointerMove`'s guard — the one that
	 * would otherwise animate the very segment a dialog is asking about.
	 */
	it('does not drag the measured segment around while the prompt is open', async () => {
		const h = harness();
		const tool = newTool(h, () => new Promise<number | null>(() => {
			/* deliberately never settles: the prompt stays open */
		}));
		click(tool, at(0, 0));
		click(tool, at(800, 0));
		await flush();

		tool.pointerMove(at(2500, 2500));

		expect(h.context.renderState.measurement).toEqual({
			start: { x: 0, y: 0 },
			end: { x: 800, y: 0 },
		});
	});

	it('takes it down once the distance is answered and the calibration dispatches', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = newTool(h);
		click(tool, at(0, 0));

		click(tool, at(800, 0));
		await flush();

		expect(h.inputs).toHaveLength(1);
		expect(h.context.renderState.measurement).toBeNull();
	});

	it('takes it down when the recalibration confirmation is declined', async () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			planId: h.planId,
		createCommand: h.createCommand,
			hasSpatialObjects: () => true,
			confirmRecalibration: () => Promise.resolve(false),
			reportRejected: h.reportRejected,
			// Slice 17 split this door from `reportRejected` — a refusal this tool makes before
			// building a command, which no dispatcher ever sees. Both literals here omitted it.
			reportInvalidInput: h.reportInvalidInput,
		});
		tool.activate(h.context);
		click(tool, at(0, 0));

		click(tool, at(800, 0));
		await flush();

		expect(h.inputs).toEqual([]);
		expect(h.context.renderState.measurement).toBeNull();
	});

	it('takes it down when two clicks land in the same place', async () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(500, 500));

		click(tool, at(500, 500));
		await flush();

		expect(h.supplierMeasurements).toEqual([]);
		expect(h.context.renderState.measurement).toBeNull();
	});

	it('takes it down on cancel, with the first point placed and nothing else', () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(100, 100));

		tool.cancel();

		expect(h.context.renderState.measurement).toBeNull();
	});

	// `deactivate()` clears `context` after calling `cancel()`, so the clear has to read the
	// context BEFORE the resets — switching tools mid-gesture would otherwise leave the
	// segment painted on a canvas no tool owns any more.
	it('takes it down on deactivate', () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(100, 100));

		tool.deactivate();

		expect(h.context.renderState.measurement).toBeNull();
	});

	/**
	 * The generation guard, on the segment rather than on the dispatch. A gesture cancelled
	 * while its prompt was open unwinds LATER, and its `finally` must not wipe the anchor a
	 * new gesture has drawn in the meantime — which is the whole reason that clear is
	 * guarded rather than unconditional.
	 */
	it('a stale gesture unwinding does not wipe the new gesture segment', async () => {
		const h = harness();
		// Definite assignment — see `viewRootCreateProject.test.ts` for the whole reason: a
		// `| null` declared here narrows to `null` at every read below, because the assignment
		// is inside a callback TypeScript cannot see run.
		let release!: (distance: number | null) => void;
		const tool = newTool(
			h,
			() =>
				new Promise<number | null>((resolve) => {
					release = resolve;
				}),
		);
		click(tool, at(0, 0));
		click(tool, at(800, 0));
		await flush();

		tool.cancel();
		click(tool, at(50, 50)); // the new gesture's anchor
		release(3200);
		await flush();

		expect(h.context.renderState.measurement).toEqual({
			start: { x: 50, y: 50 },
			end: { x: 50, y: 50 },
		});
		expect(h.inputs).toEqual([]);
	});
});

/**
 * Holding Shift measures along a whole angle from the anchor — the same 15 degree step the
 * polygon tool constrains to, through the same `SnapService.snapDirection`, so "hold Shift
 * for a straight line" means one thing in this editor rather than two.
 *
 * It carries more weight here than it does there: what a user calibrates against is almost
 * always something drawn straight — a wall, a scale bar, a printed dimension line — and a
 * calibration taken a degree off is a scale error that every area on the plan then inherits.
 */
describe('the angle constraint on a calibration', () => {
	it('pulls the rubber band onto the nearest whole angle from the anchor', () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(0, 0));

		tool.pointerMove(shiftAt(1000, 60));

		// About 3.4 degrees off the horizontal, which the 15 degree step flattens.
		expect(h.context.renderState.measurement).toEqual({
			start: { x: 0, y: 0 },
			end: { x: 1000, y: 0 },
		});
	});

	it('measures the CONSTRAINED distance, not the one the hand described', async () => {
		const h = harness();
		const measured: number[] = [];
		const tool = newTool(h, (distance) => {
			measured.push(distance);
			return Promise.resolve(null); // dismissed: this case is about what was asked
		});

		click(tool, at(0, 0));
		click(tool, shiftAt(1000, 60));
		await flush();

		// 1000.8 is the hand's own length; the point placed is the projection onto the
		// horizontal, so the length the user is asked to put a real-world figure on is 1000.
		expect(measured.at(0)).toBeCloseTo(1000, 6);
	});

	it('leaves an unmodified gesture exactly where the pointer was', () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(0, 0));

		tool.pointerMove(at(1000, 60));

		expect(h.context.renderState.measurement).toEqual({
			start: { x: 0, y: 0 },
			end: { x: 1000, y: 60 },
		});
	});
});
