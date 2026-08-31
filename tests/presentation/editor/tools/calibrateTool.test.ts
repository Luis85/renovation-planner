import { describe, expect, it } from 'vitest';
import { CalibrateTool } from '../../../../src/presentation/editor/tools/calibrate-tool';
import {
	at,
	click,
	flush,
	harness,
	newTool,
	noop,
	type Harness,
} from '../../../helpers/calibrateHarness';

describe('CalibrateTool', () => {
	it('dispatches once after two clicks, with both worldPoints and the supplied distance', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = newTool(h);

		click(tool, at(812, 240));
		await flush();
		expect(h.dispatched).toHaveLength(0); // still waiting for the second point

		tool.pointerDown(at(812, 1040));
		await flush();
		// The gesture completes on pointerUp, not pointerDown — see `CalibrateTool.pointerUp`.
		// A dialog opened synchronously inside pointerdown's dispatch loses focus to the
		// browser's own mousedown-driven focus-to-<body> move, which runs AFTER the handler
		// returns; deferring the start of `complete()` to pointerup is the fix.
		expect(h.dispatched).toHaveLength(0);

		tool.pointerUp(at(812, 1040));
		await flush();

		expect(h.dispatched).toHaveLength(1);
		expect(h.inputs[0]).toEqual({
			planId: 'plan-1',
			pointA: { x: 812, y: 240 },
			pointB: { x: 812, y: 1040 },
			knownDistance: 3200,
		});
		expect(h.supplierMeasurements).toEqual([800]);
	});

	it('a drag between the completing pointerDown and its pointerUp still calibrates from the press position', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = newTool(h);
		click(tool, at(812, 240));
		tool.pointerDown(at(812, 1040)); // the press
		tool.pointerUp(at(900, 1140)); // released elsewhere — a drag, not a click
		await flush();

		// The PRESS position, not the release position: `pendingCompletion.pointB` is
		// captured at `pointerDown` time, and `pointerUp` must not re-read `event.worldPoint`.
		expect(h.inputs[0]).toEqual({
			planId: 'plan-1',
			pointA: { x: 812, y: 240 },
			pointB: { x: 812, y: 1040 },
			knownDistance: 3200,
		});
		// The same claim from the derived measurement: press-to-press is 800; press-to-release
		// would be about 904.3, so this discriminates even if only `inputs` were compared loosely.
		expect(h.supplierMeasurements).toEqual([800]);
	});

	it('reads ONLY event.worldPoint — the conversion already happened upstream', async () => {
		const h = harness();
		h.supplyNextDistance(100);
		const tool = newTool(h);
		click(tool, at(0, 0));
		click(tool, at(30, 40));
		await flush();
		expect(h.screenToWorld).not.toHaveBeenCalled();
	});

	it('cancel after the first click clears the pending point and dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(100);
		const tool = newTool(h);

		tool.pointerDown(at(1, 1));
		tool.cancel();
		tool.pointerDown(at(2, 2));
		await flush();

		// The post-cancel click became a NEW first point, not the second half of a gesture.
		expect(h.dispatched).toHaveLength(0);
		expect(h.supplierMeasurements).toHaveLength(0);
	});

	it('deactivate before the prompt clears a pending FIRST point and dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(100);
		const tool = newTool(h);
		tool.pointerDown(at(1, 1));
		tool.deactivate();
		tool.activate(h.context);
		tool.pointerDown(at(2, 2));
		await flush();
		expect(h.dispatched).toHaveLength(0);
	});

	it('answering the distance prompt AFTER deactivate dispatches nothing', async () => {
		const h = harness();
		let answer!: (distance: number | null) => void;
		const gate = new Promise<number | null>((resolve) => {
			answer = resolve;
		});
		const tool = newTool(h, () => gate);
		click(tool, at(812, 240));
		click(tool, at(812, 1040)); // the gesture is now parked at the prompt
		tool.deactivate();
		answer(3200);
		await flush();
		await flush();

		// The gesture was abandoned mid-prompt; a late answer must not calibrate whatever
		// plan the editor has switched to in the meantime.
		expect(h.dispatched).toHaveLength(0);
		expect(h.inputs).toHaveLength(0);
	});

	it('a cancelled distance prompt dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(null);
		const tool = newTool(h);
		click(tool, at(0, 0));
		click(tool, at(10, 0));
		await flush();
		expect(h.dispatched).toHaveLength(0);
	});

	/**
	 * **The guard stays; the SILENCE goes** (design slice 17).
	 *
	 * Refusing before the prompt is right and stays: asking a user to measure a distance the
	 * tool has already decided is meaningless is worse than not asking. What was wrong is what
	 * happened next — the first click's anchor was wiped and the gesture reset with nothing
	 * said, so a user who mis-clicked twice in one spot lost a placed point and got no reason.
	 * That is the silent no-op this slice exists to remove, and the table routes it to a toast:
	 * an explicit operation, attributable to no single field.
	 *
	 * Note what this does NOT change: the command is still never dispatched, so the domain's
	 * own `calibration.coincident-points` is still unreachable from here. The tool raises the
	 * same coded error the domain would have, from the one factory that spells it.
	 */
	it('reports coincident clicks rather than silently discarding the first point', async () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(5, 5));
		click(tool, at(5, 5));
		await flush();
		expect(h.dispatched).toHaveLength(0);
		expect(h.supplierMeasurements).toHaveLength(0);
		expect(h.rejected.map((error) => error.code)).toEqual(['calibration.coincident-points']);
	});

	it('a non-positive or non-finite supplied distance dispatches nothing', async () => {
		for (const bad of [-4, Number.NaN]) {
			const h = harness();
			h.supplyNextDistance(bad);
			const tool = newTool(h);
			click(tool, at(0, 0));
			click(tool, at(10, 0));
			await flush();
			expect(h.dispatched).toHaveLength(0);
		}
	});

	it('events before activate() belong to no editor and dispatch nothing', async () => {
		const h = harness();
		const tool = new CalibrateTool({
			supplyKnownDistance: h.supplyKnownDistance,
			createCommand: h.createCommand,
			hasSpatialObjects: h.hasSpatialObjects,
			confirmRecalibration: h.confirmRecalibration,
			reportRejected: h.reportRejected,
		});
		tool.pointerDown(at(1, 1));
		tool.pointerDown(at(2, 2));
		await flush();
		expect(h.dispatched).toHaveLength(0);
	});

	it('pointerMove and a pointerUp with no matching pointerDown are inert', () => {
		const h = harness();
		const tool = newTool(h);
		// No `pointerDown` precedes either call — the gesture no real mouse produces (a
		// release with no matching press), and the one this project has already recorded
		// once as a rig defect (CLAUDE.md, slice 8's e2e rig). `pointerUp` must not throw
		// and must not have anything buffered to complete.
		expect(() => {
			tool.pointerMove(at(1, 2));
			tool.pointerUp(at(1, 2));
		}).not.toThrow();
		expect(h.dispatched).toHaveLength(0);
	});

	it('a gesture cancelled between the completing pointerDown and its pointerUp dispatches nothing', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = newTool(h);
		click(tool, at(812, 240));
		// The second point's `pointerDown` buffers `pendingCompletion` — `complete()` has
		// not started yet, which is the whole point of deferring it to `pointerUp`.
		tool.pointerDown(at(812, 1040));
		// `cancel()` is what `ToolManager.cancelGesture()` calls on Escape, and what
		// `PlanCanvas.onPointerCancel` calls when the browser claims the gesture for
		// scrolling (`pointercancel`, no `pointerup` ever follows on a real device) — either
		// way it must clear the buffered completion before any `pointerUp` arrives for it.
		tool.cancel();
		// The `pointerUp` that WOULD have completed the gesture, had it not been cancelled —
		// on a real `pointercancel` this call never happens at all, but a `cancel()` reached
		// through Escape can still be followed by the original press's `pointerUp`, so the
		// guard must hold even then.
		tool.pointerUp(at(812, 1040));
		await flush();
		expect(h.dispatched).toHaveLength(0);
		expect(h.supplierMeasurements).toHaveLength(0);
	});

	it('a secondary or auxiliary button places nothing and never starts a gesture', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = newTool(h);
		tool.pointerDown({ ...at(812, 240), button: 'secondary' });
		tool.pointerDown({ ...at(812, 1040), button: 'auxiliary' });
		await flush();
		// Not merely "did not dispatch": neither click may have become the pending FIRST
		// point either, or the next primary click would complete a gesture over a point the
		// user never placed with the button that places them.
		expect(h.supplierMeasurements).toEqual([]);
		expect(h.dispatched).toHaveLength(0);

		click(tool, at(812, 240));
		// The completing pointerDown, buffered — then a stray auxiliary release (a mouse
		// shares one pointerId across its buttons) must not consume it early; only the
		// matching primary release below may.
		tool.pointerDown(at(812, 1040));
		tool.pointerUp({ ...at(812, 1040), button: 'auxiliary' });
		await flush();
		expect(h.dispatched).toHaveLength(0);

		tool.pointerUp(at(812, 1040));
		await flush();
		expect(h.inputs).toEqual([
			{ planId: 'plan-1', pointA: { x: 812, y: 240 }, pointB: { x: 812, y: 1040 }, knownDistance: 3200 },
		]);
	});

	it('clicks during an outstanding prompt start no second gesture', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		h.supplyNextDistance(6400);
		let release: () => void = noop;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const asked: number[] = [];
		// Records the ask BEFORE blocking, so "was a second prompt opened?" is answerable
		// while the first one is still outstanding — which is the whole question here.
		const tool = newTool(h, async (measured) => {
			asked.push(measured);
			await held;
			return h.supplyKnownDistance(measured);
		});
		click(tool, at(0, 0));
		click(tool, at(0, 800));
		await flush();

		// Two more clicks while the first gesture's prompt is still open. Without the
		// guard these become a second gesture, and the second answer dispatches a
		// calibration derived against a scale the first one has not landed yet.
		click(tool, at(0, 0));
		click(tool, at(0, 1600));
		await flush();
		expect(asked).toEqual([800]);

		release();
		await flush();
		expect(h.inputs).toEqual([
			{ planId: 'plan-1', pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 800 }, knownDistance: 3200 },
		]);
	});

	it('the dispatched history entry undoes through the same command instance', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = newTool(h);
		click(tool, at(812, 240));
		click(tool, at(812, 1040));
		await flush();

		const gesture = h.dispatched[0];
		if (!gesture) throw new Error('nothing was dispatched');
		const result = await gesture.undo();
		if (!result.ok) throw new Error('expected ok');
		expect(h.undoCount).toBe(1);
	});

	/**
	 * A refused dispatch — a sidecar revision conflict, `plan-geometry.external-modification`,
	 * a degenerate scale — used to vanish silently: the gesture's own `Result` was discarded
	 * with no seam to report it through. `DrawPolygonTool` and `SelectTool` both surface a
	 * refused dispatch through `reportRejected`; this is the same wiring for `CalibrateTool`.
	 */
	it('reports a refused dispatch through reportRejected', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		h.failNextExecute({ category: 'Persistence', code: 'plan.revision-conflict', message: 'stale' });
		const tool = newTool(h);

		click(tool, at(0, 0));
		click(tool, at(100, 0));
		await flush();

		expect(h.dispatched).toHaveLength(1); // dispatched — and refused, not silently dropped
		expect(h.rejected).toHaveLength(1);
		expect(h.rejected[0]?.message).toBe('stale');
	});

	it('reports nothing on a successful dispatch', async () => {
		const h = harness();
		h.supplyNextDistance(3200);
		const tool = newTool(h);

		click(tool, at(0, 0));
		click(tool, at(100, 0));
		await flush();

		expect(h.dispatched).toHaveLength(1);
		expect(h.rejected).toHaveLength(0);
	});
});

/**
 * Builds a `CalibrateTool` over `harness()`'s permissive defaults, overridden per test —
 * and hands back `dispatched` plus a count of how many times the distance prompt was
 * reached, since a stale gesture must not merely fail to dispatch: it must not ask the
 * user anything either, and `dispatched` alone cannot tell those apart.
 */
function makeTool(overrides: Pick<Harness, 'hasSpatialObjects' | 'confirmRecalibration'>): {
	tool: CalibrateTool;
	dispatched: UndoableCommand[];
	distancePrompts: () => number;
} {
	const h = harness();
	h.supplyNextDistance(3200);
	let distancePromptCount = 0;
	const tool = new CalibrateTool({
		supplyKnownDistance: (measuredWorldUnits) => {
			distancePromptCount += 1;
			return h.supplyKnownDistance(measuredWorldUnits);
		},
		createCommand: h.createCommand,
		hasSpatialObjects: overrides.hasSpatialObjects,
		confirmRecalibration: overrides.confirmRecalibration,
		reportRejected: h.reportRejected,
	});
	tool.activate(h.context);
	return { tool, dispatched: h.dispatched, distancePrompts: () => distancePromptCount };
}

/**
 * Drives one full two-click gesture and drains its microtask chain (see `flush`). Each
 * click is down+up on the SAME point, matching the grammar a real mouse produces — a bare
 * `pointerDown` with no matching `pointerUp` is a sequence no mouse can produce, and CLAUDE.md
 * records that exact shape certifying a broken Escape path in slice 8's rig.
 */
async function calibrate(tool: CalibrateTool): Promise<void> {
	click(tool, at(812, 240));
	click(tool, at(812, 1040));
	await flush();
}

describe('the recalibration gate', () => {
	/**
	 * The trigger is whether objects will be RESCALED, not whether this is the first
	 * calibration — a freshly imported plan with nothing drawn on it has nothing to lose,
	 * and asking there is the "are you sure" that trains people to click through the ones
	 * that matter.
	 */
	it('asks nothing on a plan with no geometry', async () => {
		let asked = 0;
		const { tool, dispatched } = makeTool({
			hasSpatialObjects: () => false,
			confirmRecalibration: () => {
				asked += 1;
				return Promise.resolve(true);
			},
		});

		await calibrate(tool);

		expect(asked).toBe(0);
		expect(dispatched).toHaveLength(1);
	});

	it('asks before rescaling a plan that has geometry', async () => {
		let asked = 0;
		const { tool, dispatched } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () => {
				asked += 1;
				return Promise.resolve(true);
			},
		});

		await calibrate(tool);

		expect(asked).toBe(1);
		expect(dispatched).toHaveLength(1);
	});

	it('dispatches nothing when the user declines', async () => {
		const { tool, dispatched, distancePrompts } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () => Promise.resolve(false),
		});

		await calibrate(tool);

		expect(dispatched).toEqual([]);
		// The ordering claim itself: a user about to decline is never made to answer the
		// distance prompt first. `dispatched` alone cannot tell "asked, then declined,
		// then would-have-prompted-but-didn't" apart from "prompted anyway and only the
		// dispatch was blocked" — this is the one assertion that does.
		expect(distancePrompts()).toBe(0);
	});

	/**
	 * The generation rule, applied to the SECOND await this method now has. Without the
	 * re-check, an Escape while the confirmation sat open let a late `true` calibrate a
	 * plan the user had cancelled out of — the exact defect slice 7's counter exists for,
	 * reintroduced by adding an await above it.
	 */
	it('drops a confirmation that resolves after the gesture was cancelled', async () => {
		let release: ((confirmed: boolean) => void) | null = null;
		const { tool, dispatched, distancePrompts } = makeTool({
			hasSpatialObjects: () => true,
			confirmRecalibration: () =>
				new Promise<boolean>((resolve) => {
					release = resolve;
				}),
		});

		const gesture = calibrate(tool);
		await Promise.resolve();
		tool.cancel();
		release?.(true);
		await gesture;

		expect(dispatched).toEqual([]);
		// Not merely "did not dispatch": a stale gesture that reaches the distance prompt
		// still asked the user something about points and a plan they no longer control —
		// the trailing generation check catches the dispatch either way, so ONLY this
		// assertion is what actually exercises the re-check right after the confirmation.
		expect(distancePrompts()).toBe(0);
	});
});

describe('an interrupted second press', () => {
	/**
	 * `abandonGesture()` is what focus loss reaches, and it must undo exactly the press that
	 * will never be released — no more. The first click is COMPLETE (down and up both
	 * happened), so its anchor is the user's, not transient state.
	 *
	 * The trap is that `pointerDown` does not leave that anchor where it found it: placing the
	 * second point MOVES `pointA` into `pendingCompletion` and nulls it. So clearing the
	 * pending completion alone — which is what the first version did, under a comment claiming
	 * the opposite — loses both points, and the user's next click starts a fresh calibration
	 * from scratch with the abandoned segment still drawn over it.
	 */
	it('restores the first point, so the next click retries the SECOND one', async () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(100, 100)); // the first point, a complete click
		tool.pointerDown(at(900, 100)); // the second point placed…

		tool.abandonGesture(); // …and focus lost before the release

		// The next click is the second point again, not a new first one: one dispatch, and it
		// measures from the ORIGINAL anchor.
		h.supplyNextDistance(1000);
		click(tool, at(500, 100));
		await flush();

		expect(h.supplierMeasurements).toEqual([400]);
		expect(h.dispatched).toHaveLength(1);
	});

	it('redraws the anchor alone, rather than leaving the abandoned segment on screen', () => {
		const h = harness();
		const tool = newTool(h);
		click(tool, at(100, 100));
		tool.pointerDown(at(900, 100));

		tool.abandonGesture();

		// The zero-length marker the first click leaves — the same thing the user saw while
		// they were choosing where to put the second point.
		expect(h.context.renderState.measurement).toEqual({
			start: { x: 100, y: 100 },
			end: { x: 100, y: 100 },
		});
	});

	it('does nothing at all when no second press is pending', async () => {
		// Between clicks there is no interrupted press, so the anchor and its marker are
		// untouched — the same rule the drawing tool's no-op states.
		const h = harness();
		const tool = newTool(h);
		click(tool, at(100, 100));

		tool.abandonGesture();

		h.supplyNextDistance(1000);
		click(tool, at(500, 100));
		await flush();

		expect(h.dispatched).toHaveLength(1);
	});
});
