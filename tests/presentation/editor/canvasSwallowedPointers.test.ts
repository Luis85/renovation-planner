/**
 * @vitest-environment jsdom
 *
 * What a pointer whose PRESS this canvas swallowed is owed for the rest of its life.
 *
 * Split out of `canvasGestureOwnership.test.ts` when that file crossed the suite's 450-line
 * cap for the second time. The boundary is a real one rather than an arbitrary halving:
 * `swallowedPointers` is a record that deliberately OUTLIVES the gesture that created it —
 * "held until that pointer ends" — where the rest of that file is about a gesture having one
 * owner while it runs. Every case here happens AFTER the pan is over.
 *
 * The recurring defect is a door that did not ask. The set was consulted at the press, the
 * release and the cancellation, and each of those was added by its own round of review; the
 * MOVE was found last, and it was the door where the damage lasted — a swallowed finger
 * steered the rubber band the moment the pan owner let go, and its eventual release is
 * swallowed too, so nothing ever corrected it.
 */
import { describe, expect, it } from 'vitest';
import { settle } from '../../helpers/editor';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { click, drawnLines, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';

const PLAN = 'plan-e2e' as never;

function key(canvas: HTMLElement, type: 'keydown' | 'keyup', init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
	canvas.dispatchEvent(event);
	return event;
}

/** The mounted editor, which is what every case here reads. */
async function editor() {
	const built = await rig();
	const canvas = built.harness.canvasEl;
	if (canvas === null) throw new Error('expected a mounted canvas');
	return { ...built, canvas, camera: useEditorStore(built.harness.pinia) };
}

it('keeps a swallowed pointer out of the tool after the gesture that swallowed it ends', async () => {
	// `swallowedPointers` holds an id until that POINTER ends, not until the gesture does —
	// its own docblock says so, and names this exact scene one event later: finger A
	// space-pans, finger B is swallowed, A releases and ends the pan, and B reports back to a
	// canvas with no pan running. The docblock then calls the set "consulted at BOTH ends",
	// meaning the release and the cancellation. The MOVE is a third door, and it consulted
	// nothing — so B, a finger deliberately excluded from the gesture, steered the rubber band
	// the moment A let go, and B's eventual release is swallowed, so nothing corrects it.
	const { harness, canvas } = await editor();
	toolbarButton(harness, 'Draw zone').click();
	await settle();

	click(canvas, 500, 100);
	pointer(canvas, 'pointermove', 600, 200, 0, 1, 0);
	await settle();

	canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
	pointer(canvas, 'pointerdown', 700, 300, 0, 1); // finger A takes the camera…
	pointer(canvas, 'pointermove', 700, 300, 0, 1); // …moving it nowhere
	pointer(canvas, 'pointerdown', 900, 500, 0, 2); // finger B, swallowed
	pointer(canvas, 'pointerup', 700, 300, 0, 1); // A lets go and the pan ends
	await settle();
	const drawnBefore = drawnLines(harness.stage);
	expect(drawnBefore.length).toBeGreaterThan(0);

	pointer(canvas, 'pointermove', 1000, 600, 0, 2); // B is still down, and still nothing to us
	await settle();

	expect(drawnLines(harness.stage)).toEqual(drawnBefore);
	harness.unmount();
});

it('does not REMEMBER a swallowed pointer either, for a later modifier to replay', async () => {
	// The half a routing-only guard leaves live, and it needed its own case: put the swallowed
	// test below the record instead of above it and the whole suite still passes, because
	// every other case reaches the swallowed pointer through the routing. B's move is refused
	// as a tool move and written down anyway, and the next Shift press rebuilds a synthetic
	// move out of it — the same shape as the foreign-hover replay one round earlier, which is
	// why the guard sits above both things this handler does rather than beside one of them.
	//
	// The pan is taken at the cursor's own pixel so that an honest re-issue is a no-op here
	// and any change is B's coordinates arriving.
	const { harness, canvas } = await editor();
	toolbarButton(harness, 'Draw zone').click();
	await settle();

	click(canvas, 500, 100);
	pointer(canvas, 'pointermove', 600, 200, 0, 1, 0);
	await settle();

	canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
	pointer(canvas, 'pointerdown', 600, 200, 0, 1);
	pointer(canvas, 'pointermove', 600, 200, 0, 1);
	pointer(canvas, 'pointerdown', 900, 500, 0, 2); // finger B, swallowed
	pointer(canvas, 'pointerup', 600, 200, 0, 1); // A lets go and the pan ends
	pointer(canvas, 'pointermove', 1000, 600, 0, 2); // B moves, and is nothing to us
	await settle();
	const drawnBefore = drawnLines(harness.stage);
	expect(drawnBefore.length).toBeGreaterThan(0);

	canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }));
	await settle();

	expect(drawnLines(harness.stage)).toEqual(drawnBefore);
	harness.unmount();
});

describe('a pointer the canvas swallowed, cancelled after the pan ended', () => {
	it('does not destroy the tool’s buffer', async () => {
		// Finger A space-pans; finger B presses and is swallowed; A releases, ending the pan;
		// then the OS cancels B. The cancel branch asks "is a pan running", which is now false,
		// so it cancels the ACTIVE TOOL — for a pointer that tool never received a press from.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, 11); // A claims the pan
		pointer(canvas, 'pointerdown', 300, 400, 0, 12); // B swallowed
		pointer(canvas, 'pointerup', 300, 300, 0, 11); // A releases; the pan ends
		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 12, bubbles: true }));
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		// The buffer should have survived: a third vertex and a close land on the original two.
		click(canvas, 600, 200);
		click(canvas, 500, 100);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('does not hand the tool a RELEASE it never got a press for', async () => {
		// The same staleness on the other path. B's release after the pan ends falls through to
		// the tool, which placed a vertex the user never asked for — a release with no matching
		// press, which is the grammar defect this file exists to refuse.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointerdown', 300, 400, 0, 12);
		pointer(canvas, 'pointerup', 300, 300, 0, 11);
		pointer(canvas, 'pointerup', 300, 400, 0, 12);
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		// Three deliberate vertices close a triangle. A stray fourth from B's release would
		// leave the close click nowhere near the buffer's first point.
		click(canvas, 600, 200);
		click(canvas, 500, 100);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});
});

/**
 * **Two cases stood here and are deleted rather than repaired**, because the input they
 * described cannot occur. They drove a primary press arriving as a `pointerdown` DURING a
 * middle-button pan, to certify that `swallowedPointers` — keyed by pointer id, which one
 * mouse shares across every button — could not swallow the pan owner's own release. Under
 * the real event grammar the collision has no producer: a chorded press fires no
 * `pointerdown` at all, so nothing is ever swallowed under an id that already owns a pan.
 *
 * What the two were reaching for is covered by inputs that do exist: the chord describe
 * below holds the release path with the stream a mouse really sends, the touch cases above
 * hold `swallowedPointers` itself where distinct pointer ids make it real, and 'a pointer
 * taken away mid-pan' holds the cancellation half.
 *
 * Left as a comment rather than removed silently: the ORDERING in `onPointerUp` and
 * `onPointerCancel` is still spelled owner-first, and a reader who finds it unguarded should
 * find out here that the collision it was written for is unreachable rather than untested.
 */

it('does not strand its id when the pointer LEAVES before it is released', async () => {
	// The one escape from "held until that pointer ends". A swallowed press returns before
	// `setPointerCapture`, so that pointer is uncaptured — and if it crosses the pane edge its
	// release lands on some other element and the entry is never removed. The id then outlives
	// the hand: a pen's is stable and a touch id is recycled, so the NEXT legitimate press
	// under it is forwarded (the press door keeps no such test) while its moves and its release
	// are both swallowed by the stale entry, leaving the tool gesture in flight for good — the
	// camera locked, and the preview live for whatever the user clicks next.
	const { harness, canvas, zonesRepo } = await editor();
	toolbarButton(harness, 'Select').click();
	await settle();

	// Pointer 11 drags the zone; finger 12 lands mid-drag and is swallowed…
	pointer(canvas, 'pointerdown', 300, 300, 0, 11);
	pointer(canvas, 'pointermove', 400, 300, 0, 11);
	pointer(canvas, 'pointerdown', 900, 500, 0, 12);
	// …and leaves the pane still down, so its release will land somewhere else entirely.
	canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 12, bubbles: true }));
	pointer(canvas, 'pointerup', 400, 300, 0, 11);
	await settle();
	const afterFirst = expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points[0].x;

	// The id comes back, and this drag is nobody's business but its own.
	pointer(canvas, 'pointerdown', 300, 300, 0, 12);
	pointer(canvas, 'pointermove', 500, 300, 0, 12);
	pointer(canvas, 'pointerup', 500, 300, 0, 12);
	await settle();

	expect(expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points[0].x).not.toBe(afterFirst);
	harness.unmount();
});

it('says nothing about a TOOL gesture it does not own either, not just a pan', async () => {
	// The leave door's own comment states the general rule — "a leave from anything but the
	// owner says nothing about the gesture, so it does nothing at all, `lastStagePoint`
	// included" — and its guard implemented that for the pan alone. During a TOOL gesture a
	// foreign pointer crossing the edge fell straight through and forgot where the drawing
	// hand was, blanking the status bar with it.
	const { harness, canvas, camera } = await editor();
	toolbarButton(harness, 'Select').click();
	await settle();

	pointer(canvas, 'pointerdown', 300, 300, 0, 11);
	pointer(canvas, 'pointermove', 340, 300, 0, 11);
	await settle();
	const readout = camera.pointerWorld;
	expect(readout).not.toBeNull();

	canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 12, bubbles: true }));
	await settle();

	expect(camera.pointerWorld).toEqual(readout);
	harness.unmount();
});
