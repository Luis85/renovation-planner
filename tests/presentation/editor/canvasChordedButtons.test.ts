/**
 * @vitest-environment jsdom
 *
 * **A second button pressed while another is held — the class the review found late, and the
 * one whose whole event grammar this suite used to get wrong.**
 *
 * W3C Pointer Events, "chorded button interactions": `pointerdown` fires only on the
 * transition from no buttons to some, and `pointerup` only when the LAST button comes up.
 * Every button change in between is a `pointermove` whose `button` names what changed and
 * whose `buttons` carries what is still held. Measured in a real Chromium, not taken from the
 * text: a left-drag with a middle press on top produces `pointermove button=1 buttons=5`, and
 * the middle button's compatibility `mousedown` fires beside it exactly as always.
 *
 * Everything here used to synthesize a second `pointerdown` and an early `pointerup` instead
 * — an event stream no mouse produces — and passed in both worlds, which is why the routing it
 * certified was hardened against inputs that never occur while three real defects stood:
 *
 * 1. a pan that never ended, because the only release named the other button;
 * 2. a tool drag silently lost, because every tool refuses a release that is not primary;
 * 3. Chrome's autoscroll widget opening over a live drag, because the suppression sat on a
 *    `pointerdown` the press never fired.
 *
 * Split out of `canvasGestureOwnership.test.ts` when that file crossed the suite's 450-line
 * cap. The boundary is the class rather than a halving: that file is about a gesture having
 * one owner, this one about what a device sends when a second button joins.
 *
 * The touch cases stay next door on purpose — distinct `pointerId`s genuinely do produce
 * their own presses and releases, so none of this applies to them.
 */
import { describe, expect, it } from 'vitest';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { settle } from '../../helpers/editor';
import { chord, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';

const PLAN = 'plan-e2e' as never;

/** The mounted editor plus the camera store behind it, which is what every case reads. */
async function editor() {
	const built = await rig();
	const canvas = built.harness.canvasEl;
	if (canvas === null) throw new Error('expected a mounted canvas');
	return { ...built, canvas, camera: useEditorStore(built.harness.pinia) };
}

function key(canvas: HTMLElement, type: 'keydown' | 'keyup', init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
	canvas.dispatchEvent(event);
	return event;
}

/**
 * Only the CLASS is assertable — jsdom resolves no styles — so what the pan cases hold is the
 * precedence, decided in the component precisely so that it can be.
 */
function cursorClasses(canvas: HTMLElement): string[] {
	return [...canvas.classList].filter((name) => name.startsWith('rp-plan-canvas-'));
}

/** One middle press, cancelable, so `defaultPrevented` means what it says. */
function middlePress(canvas: HTMLElement): PointerEvent {
	const event = new PointerEvent('pointerdown', {
		button: 1,
		buttons: 4,
		pointerId: 1,
		clientX: 300,
		clientY: 300,
		bubbles: true,
		cancelable: true,
	});
	canvas.dispatchEvent(event);
	return event;
}

/**
 * The COMPATIBILITY `mousedown` a middle press fires, which is where the autoscroll rule
 * lives — `held` is the `buttons` mask, 4 for a bare press and 5 while the primary is down.
 *
 * jsdom synthesizes no compatibility mouse events from pointer events, so this is dispatched
 * by hand; that a real Chromium sends exactly these two shapes was measured, and
 * `docs/tests/cases/Canvas Navigation.md` step 13d is where a real mouse confirms the
 * suppression lands.
 */
function middleMouseDown(canvas: HTMLElement, held: number): MouseEvent {
	const event = new MouseEvent('mousedown', {
		button: 1,
		buttons: held,
		clientX: 300,
		clientY: 300,
		bubbles: true,
		cancelable: true,
	});
	canvas.dispatchEvent(event);
	return event;
}

describe('a second mouse button pressed during a pan', () => {
	it('does not end the pan when it is the one released first', async () => {
		// A mouse shares one `pointerId` across its buttons, so this is an ordinary input: the
		// user is space-dragging and reflexively clicks the middle button. Ending the pan on
		// that would stop the camera while the primary button is still down — the view freezes
		// under a hand that is still moving.
		//
		// The frozen camera is the whole of the observable damage, MEASURED rather than
		// assumed: the second-order consequence — the eventual primary release reaching
		// `SelectTool` as a release with no matching press — is absorbed by that tool's own
		// no-gesture guard, so a case asserting the zone did not move passes with the defect
		// present and was dropped rather than kept. That guard is where the invariant belongs
		// (it holds for tools not yet written); this case is what holds the routing.
		//
		// Both halves of the middle click are CHORDS, which is the only shape they can have:
		// the primary button is already down, so neither a `pointerdown` nor a `pointerup`
		// fires for them. This case used to synthesize both, and so drove a stream no mouse
		// produces.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		chord(canvas, 340, 300, 1, 5); // middle pressed, primary still held
		chord(canvas, 340, 300, 1, 1); // middle released, primary still held
		await settle();
		const interrupted = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 420, 300);
		await settle();

		expect(camera.viewport.pan.x).not.toBe(interrupted);
		harness.unmount();
	});
});

describe('a middle press refused because another gesture is running', () => {
	// The canvas CLAIMS the middle button, so it owes the suppression on every middle press
	// rather than only where the override takes one. Chrome opens its autoscroll widget
	// otherwise and the pane scrolls under the drag still running.
	//
	// **The suppression is asserted on the `mousedown`, and that is the correction rather than
	// a preference.** These two cases used to send a middle `pointerdown` mid-drag and check
	// that IT was prevented — an input measured not to exist: with the primary button already
	// held, a real Chromium fires no `pointerdown` for the second button at all, so the
	// handler carrying the suppression was never reached and the widget opened anyway. The
	// pair survives because camera mode is the DEFAULT state and a fix aimed at the tool path
	// alone would leave the more reachable half open, which this review has already seen twice.
	it('still suppresses the browser default during a TOOL drag', async () => {
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		pointer(canvas, 'pointerdown', 50, 50);
		pointer(canvas, 'pointermove', 60, 60);

		expect(middleMouseDown(canvas, 5).defaultPrevented).toBe(true);
		harness.unmount();
	});

	it('still suppresses it during a CAMERA-MODE drag', async () => {
		const { harness, canvas } = await editor();
		pointer(canvas, 'pointerdown', 50, 50);
		pointer(canvas, 'pointermove', 60, 60);

		expect(middleMouseDown(canvas, 5).defaultPrevented).toBe(true);
		harness.unmount();
	});

	it('suppresses a BARE middle press too, which no longer comes free from the pointer door', async () => {
		// The un-chorded case, which used to be covered by cancelling the middle `pointerdown`
		// and is now the same door as the chorded one. Nothing else holds it: with the pointer
		// suppression gone, a build that only handled the chord would leave an idle canvas
		// opening the autoscroll widget on every middle click.
		const { harness, canvas } = await editor();

		expect(middleMouseDown(canvas, 4).defaultPrevented).toBe(true);
		harness.unmount();
	});

	it('leaves the PRIMARY button’s mouse default alone, so a click still focuses the canvas', async () => {
		// The suppression is the middle button's, not every button's: cancelling a primary
		// `mousedown` prevents focus, and the canvas listens for keys on itself — so every
		// keyboard gesture in this file would stop working after a click.
		const { harness, canvas } = await editor();
		const event = new MouseEvent('mousedown', { button: 0, buttons: 1, bubbles: true, cancelable: true });

		canvas.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
		harness.unmount();
	});

	it('does not let the suppression start a pan the lock refused', async () => {
		// The other direction: suppressing the default must not be mistaken for claiming the
		// gesture. A build that hoisted the claim rather than the `preventDefault` would pass
		// the two cases above and break the lock this review spent a round establishing.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		pointer(canvas, 'pointerdown', 50, 50);
		pointer(canvas, 'pointermove', 60, 60);
		const held = { ...camera.viewport.pan };

		middlePress(canvas);
		pointer(canvas, 'pointermove', 400, 400);
		await settle();

		expect(camera.viewport.pan).toEqual(held);
		expect(cursorClasses(canvas)).not.toContain('rp-plan-canvas-panning');
		harness.unmount();
	});
});

describe('the middle button pressed during a camera-mode drag', () => {
	/**
	 * Camera mode is the DEFAULT — no tool — so it is the MORE reachable half of every rule
	 * the pan override carries, and a fix applied only to the override leaves it broken. Both
	 * directions of the chord live here for that reason.
	 */
	it('does not kill a primary drag whose button is still held', async () => {
		// A bare left-drag pan with a middle click on top of it. The middle click is two
		// chords, not a press and a release: the primary button is already down, so no
		// `pointerdown` or `pointerup` fires for it at all.
		const { harness, canvas, camera } = await editor();
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		await settle();

		chord(canvas, 340, 300, 1, 5); // middle pressed, primary still held
		chord(canvas, 340, 300, 1, 1); // middle released, primary still held
		await settle();
		const afterMiddle = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 500, 300);
		await settle();

		expect(camera.viewport.pan.x).not.toBe(afterMiddle);
		harness.unmount();
	});

	it('ends the drag when the PRIMARY button is the one released first', async () => {
		// The mirror, and the one no `pointerup` can express: with the middle button still
		// down, releasing the primary sends a move and the eventual release names the MIDDLE
		// button — which `isPrimary` correctly refuses, so nothing ended the drag and the
		// camera went on following a cursor with no button held.
		const { harness, canvas, camera } = await editor();
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		chord(canvas, 340, 300, 1, 5); // middle pressed on top of the drag
		chord(canvas, 340, 300, 0, 4); // PRIMARY released, middle still held
		pointer(canvas, 'pointerup', 340, 300, 1); // the last button up
		await settle();
		const settled = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 700, 300);
		await settle();

		expect(camera.viewport.pan.x).toBe(settled);
		harness.unmount();
	});
});

describe('a chorded mouse button, which is the only shape a second button can have', () => {
	/**
	 * **W3C Pointer Events, "chorded button interactions."** `pointerdown` fires only on the
	 * transition from no buttons to some, and `pointerup` only when the LAST button is
	 * released. A second button pressed or released while another is held arrives as a
	 * `pointermove` whose `button` names what changed and whose `buttons` carries what is
	 * still down.
	 *
	 * Which means a whole class of cases in this file used to drive an event stream no mouse
	 * can produce — a synthesized second `pointerdown`, an early `pointerup` — and the routing
	 * they certified was hardened against inputs that never occur while the real chord went
	 * unhandled. The touch cases above are unaffected: distinct `pointerId`s genuinely do
	 * produce their own presses and releases.
	 */
	it('ends the pan when the OWNING button is released first', async () => {
		// Middle-drag pan, press primary, release middle, release primary. The only `pointerup`
		// reports the PRIMARY button, so a machine waiting for a matching release never gets
		// one: the canvas stayed `panning` for the rest of the session, and every later click
		// was swallowed as a foreign press.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		pointer(canvas, 'pointerdown', 300, 300, 1); // middle: the pan begins
		pointer(canvas, 'pointermove', 340, 300, 1);
		chord(canvas, 340, 300, 0, 5); // primary pressed on top of it — middle still held
		chord(canvas, 340, 300, 1, 1); // middle RELEASED, primary still held
		pointer(canvas, 'pointerup', 340, 300, 0); // the last button up
		await settle();
		const settled = camera.viewport.pan.x;

		// The pan is over, so a bare move must not drive the camera any further.
		pointer(canvas, 'pointermove', 700, 300);
		await settle();

		expect(camera.viewport.pan.x).toBe(settled);
		harness.unmount();
	});
});

describe('a TOOL drag whose primary button is released inside a chord', () => {
	it('commits, rather than outliving the hand that made it', async () => {
		// The third path with the same shape, and the one where the damage is not a stuck
		// camera but a lost edit. `SelectTool` refuses a release that is not primary — rightly,
		// since a middle release must not commit a drag — and with the middle button held the
		// only `pointerup` names the MIDDLE button. So the primary release arrives as a move,
		// nothing ends the gesture, and the zone the user dragged snaps back with no error.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points;

		pointer(canvas, 'pointerdown', 300, 300); // on zone-a
		pointer(canvas, 'pointermove', 420, 300);
		chord(canvas, 420, 300, 1, 5); // middle pressed mid-drag
		chord(canvas, 440, 300, 0, 4); // PRIMARY released, middle still held
		pointer(canvas, 'pointerup', 440, 300, 1); // the last button up, naming the middle one
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points).not.toEqual(before);
		harness.unmount();
	});
});
