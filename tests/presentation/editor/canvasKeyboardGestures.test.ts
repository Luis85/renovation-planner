/**
 * @vitest-environment jsdom
 *
 * What the KEYBOARD asks of a canvas whose camera may already be busy — the space bar that
 * offers the camera, and the Escape that abandons a drawing.
 *
 * Split out of `canvasGestureOwnership.test.ts` when that file crossed the suite's 450-line
 * cap for the second time. The boundary is a real one rather than an arbitrary halving, and
 * the split is overdue on its own merits: the Escape cases had been accreting under a
 * describe named `a pointer taken away mid-pan`, which is not what any of them is about.
 * That file is about WHOSE a running gesture is, decided between pointers and buttons; this
 * one is about a key, which names no pointer and no button at all.
 *
 * Two shapes recur here and neither appears in the pointer file:
 *
 * 1. **A held key autorepeats at the OS rate**, so a guard keyed on live state becomes a
 *    race — whichever of the repeat and the user's release lands first wins. Three defects
 *    in this file's history are that one shape: the `preventDefault` ordering, the arming,
 *    and Escape's own suppression. The answer each time was to bind the decision to the
 *    PRESS rather than to the moment.
 * 2. **A record of the physical key is not a policy about what the software allows.**
 *    `spaceHeld` says the key is down; refusing to write it while another gesture ran made
 *    the machine disagree with the hand for as long as the user kept holding it.
 */
import { describe, expect, it } from 'vitest';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { settle } from '../../helpers/editor';
import { click, drawnLines, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
import { expectOk } from '../../helpers/domain';

const PLAN = 'plan-e2e' as never;

/** The mounted editor plus the camera store behind it, which is what every case reads. */
async function editor() {
	const built = await rig();
	const canvas = built.harness.canvasEl;
	if (canvas === null) throw new Error('expected a mounted canvas');
	return { ...built, canvas, camera: useEditorStore(built.harness.pinia) };
}

/** Focus leaving the canvas element, which is the only notice a held key or gesture gets. */
function blur(canvas: HTMLElement): void {
	canvas.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
}

function key(canvas: HTMLElement, type: 'keydown' | 'keyup', init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
	canvas.dispatchEvent(event);
	return event;
}

/** Only the CLASS is assertable — jsdom resolves no styles. See the pointer file's note. */
function cursorClasses(canvas: HTMLElement): string[] {
	return [...canvas.classList].filter((name) => name.startsWith('rp-plan-canvas-'));
}

describe('escape while the camera owns the canvas', () => {
	it('does not destroy a half-drawn polygon when it arrives mid-pan', async () => {
		// The same shape as `pointercancel`'s, in `canvasGestureOwnership.test.ts`, one input
		// over — and the destructive one: `cancelGesture()` empties the
		// vertex buffer outright. A user mid-polygon who holds space to pan and presses Escape
		// lost the whole polygon while the pan carried on underneath — measured against the
		// previous commit as no zone being closeable at all afterwards, not merely a short one.
		//
		// Escape differs from `pointercancel` in being DELIBERATE, which is the argument for
		// letting it through; it loses to the fact that a pan has nothing for Escape to undo,
		// so the tool's buffer was the only thing it could destroy.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 400, 400);
		pointer(canvas, 'pointermove', 420, 420);
		key(canvas, 'keydown', { key: 'Escape' });
		pointer(canvas, 'pointerup', 420, 420);
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		click(canvas, 620, 220);
		click(canvas, 520, 120);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('does not destroy one when a HELD Escape outlives the pan that swallowed it', async () => {
		// A phase test alone decides afresh on every autorepeat, so the initial keydown was
		// swallowed and the OS's next repeat of that same press — arriving once the button was
		// released and the phase was no longer `panning` — cleared the buffer anyway. Whether
		// the polygon survived came down to whether the release beat the next repeat, which is
		// a race rather than a rule. One press is one press.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 400, 400);
		pointer(canvas, 'pointermove', 420, 420);
		key(canvas, 'keydown', { key: 'Escape' });
		// The pan ends with Escape still physically down, and the OS keeps repeating it.
		pointer(canvas, 'pointerup', 420, 420);
		key(canvas, 'keydown', { key: 'Escape', repeat: true });
		key(canvas, 'keyup', { key: 'Escape' });
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		click(canvas, 620, 220);
		click(canvas, 520, 120);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('still lets a FRESH Escape cancel once the pan is over', async () => {
		// The other side of the repeat filter, and the reason it is `repeat` rather than a
		// blanket suppression: releasing Escape and pressing it again is new intent, and must
		// still reach the tool. Without this, a filter that keyed on the pan having swallowed
		// anything at all would leave Escape dead for the rest of the session.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 400, 400);
		pointer(canvas, 'pointermove', 420, 420);
		key(canvas, 'keydown', { key: 'Escape' });
		key(canvas, 'keyup', { key: 'Escape' });
		pointer(canvas, 'pointerup', 420, 420);
		key(canvas, 'keyup', { key: ' ' });
		// A second, separate press — `repeat: false`, as a real one is.
		key(canvas, 'keydown', { key: 'Escape' });
		await settle();

		// Cleared, so a fresh triangle closes on its own first vertex at three points.
		click(canvas, 200, 200);
		click(canvas, 300, 200);
		click(canvas, 250, 300);
		click(canvas, 202, 202);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('still lets Escape reach the tool when space is merely HELD', async () => {
		// The carve-out that must survive the fix: `armed` is not a gesture. Swallowing Escape
		// whenever space was down would break the camera lock's own deliberate exception — a
		// user must be able to abandon a drawing while holding the key that offers the camera.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);

		// Armed, never panning: no button ever goes down.
		key(canvas, 'keydown', { key: ' ' });
		key(canvas, 'keydown', { key: 'Escape' });
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		// A FRESH triangle, closed on its own first vertex. Three points prove the buffer was
		// cleared: had the two earlier vertices survived, the close click would be nowhere near
		// the buffer's first point (500, 100) and would add a sixth vertex instead of closing,
		// leaving no zone at all.
		//
		// Asserting the count rather than absence is the whole point of this spelling. The
		// first draft ended on `expect(drawn).toBeUndefined()` after two clicks, and it passed
		// against a build that swallowed Escape while armed too — measured, not assumed. Two
		// vertices cannot close either way, so it was reading the same `undefined` in both
		// worlds and pinning nothing.
		click(canvas, 200, 200);
		click(canvas, 300, 200);
		click(canvas, 250, 300);
		click(canvas, 202, 202);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});
});

describe('the space bar autorepeating through a long pan', () => {
	it('keeps suppressing the page scroll on every repeat, not just the first', async () => {
		// A held key repeats at the OS rate for as long as the pan lasts. The camera lock was
		// placed ABOVE the Space branch, so every repeat returned before reaching
		// `preventDefault()` — and Space's default is page-down, which scrolls the editor leaf
		// out from under the plan. Suppressing the first keydown is not enough when the gesture
		// is defined by holding the key.
		const { harness, canvas } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		await settle();

		const repeated = key(canvas, 'keydown', { key: ' ', repeat: true });
		await settle();

		expect(repeated.defaultPrevented).toBe(true);
		harness.unmount();
	});
});

/**
 * `spaceHeld` is a record of the PHYSICAL key, and the camera lock had been allowed to skip
 * writing it. Both cases below are the same defect from the two gestures that can be running
 * when the key goes down, and both end the other gesture to show the damage outliving it: no
 * second non-repeat keydown is ever coming for a key already held, so the machine believed
 * the key was up for as long as the user kept holding it.
 */
describe('space pressed while another gesture is already running', () => {
	it('still arms the camera once a TOOL drag ends', async () => {
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		pointer(canvas, 'pointerdown', 50, 50);
		pointer(canvas, 'pointermove', 60, 60);
		key(canvas, 'keydown', { key: ' ' });
		await settle();
		pointer(canvas, 'pointerup', 60, 60);
		await settle();

		expect(cursorClasses(canvas)).toContain('rp-plan-canvas-armed');
		harness.unmount();
	});

	it('still arms the camera once a MIDDLE-BUTTON pan ends', async () => {
		// Codex's own framing of the finding, kept as its own case because the two gestures
		// reach the lock by different routes — a tool's in-flight flag, and the store's drag.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		pointer(canvas, 'pointerdown', 50, 50, 1);
		pointer(canvas, 'pointermove', 60, 60, 1);
		key(canvas, 'keydown', { key: ' ' });
		await settle();
		pointer(canvas, 'pointerup', 60, 60, 1);
		await settle();

		// Armed, not idle: the next primary drag pans instead of reaching the active tool.
		expect(cursorClasses(canvas)).toContain('rp-plan-canvas-armed');
		harness.unmount();
	});

	it('does not let that arming MOVE the camera while the other gesture still runs', async () => {
		// The reason the lock was put at the keydown in the first place, kept as a case so the
		// fix cannot be read as having dropped the protection. It moved to the one place a
		// gesture is actually claimed — `PanOverride.pointerDown` — which is where it belongs.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		pointer(canvas, 'pointerdown', 50, 50);
		pointer(canvas, 'pointermove', 60, 60);
		key(canvas, 'keydown', { key: ' ' });
		await settle();
		const held = { ...camera.viewport.pan };
		// A second pointer pressing while the tool drag runs must claim nothing.
		pointer(canvas, 'pointerdown', 200, 200, 0, 2);
		pointer(canvas, 'pointermove', 400, 400, 0, 2);
		await settle();

		expect(camera.viewport.pan).toEqual(held);
		harness.unmount();
	});
});


describe('the window losing focus, not just the element', () => {
	/**
	 * `@blur` on the container covers focus moving WITHIN the document — a click on the
	 * toolbar, a Tab to the next control. It is not guaranteed to cover the application
	 * losing focus: Chromium can deactivate a window while leaving the focused DOM element
	 * focused, and Obsidian is Electron. The space keyup then happens in whatever the user
	 * alt-tabbed to, so this canvas never hears it and stays armed forever — which is the
	 * exact defect `onBlur` exists to prevent, reached by the exact gesture it names.
	 *
	 * **Not measurable here, and this says so rather than implying otherwise.** jsdom models
	 * no window activation, and a headless browser has no OS window to deactivate — so the
	 * suite can only check that a `window` blur is LISTENED for and does the cleanup. Whether
	 * Electron delivers the element blur too is what step 11 of
	 * `docs/tests/cases/Canvas Navigation.md` is for; registering both makes that step pass
	 * whichever way the host behaves.
	 */
	it('disarms a held space bar when the WINDOW blurs', async () => {
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		key(canvas, 'keydown', { key: ' ' });
		await settle();

		window.dispatchEvent(new FocusEvent('blur'));
		await settle();
		const before = camera.viewport.pan;

		// Armed, the next primary drag would pan. Disarmed, it belongs to the tool.
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settle();

		expect(camera.viewport.pan).toEqual(before);
		harness.unmount();
	});

	it('stops listening once the leaf is gone', async () => {
		// A window-level listener outlives its element unless something removes it, and a
		// closed Plan Editor leaf that still reacts to every window blur is a leak with
		// behaviour attached — it would reach into a disposed Pinia store.
		const { harness } = await editor();

		harness.unmount();

		expect(() => window.dispatchEvent(new FocusEvent('blur'))).not.toThrow();
	});
});

describe('a tool gesture the window took the focus away from', () => {
	/**
	 * **The blur cleanup answered for the camera and not for the tool**, which is the same
	 * omission `pointercancel` was corrected for one round earlier, at the one door that has
	 * no pointer to name. An Alt+Tab mid-drag delivers no `pointerup` — the user releases the
	 * button in another application — so without this the gesture outlives the hand.
	 *
	 * The guard is `gestureInFlight`, and it is the question `ToolManager`'s own tool-SWITCH
	 * path already asks: was a press-to-RELEASE gesture interrupted? A multi-click tool sits
	 * between clicks with the flag false, and its buffer has nothing to do with the window
	 * losing focus.
	 */
	it('releases the camera lock, instead of refusing to zoom for the rest of the session', async () => {
		// The stickiest half: `cameraIsLocked()` reads `toolManager.gestureInFlight`, so a
		// gesture left in flight refuses every wheel and both fit shortcuts from then on — with
		// nothing on screen to say why, and no way back short of reopening the leaf.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		blur(canvas);
		await settle();
		const zoom = camera.viewport.zoom;

		canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
		await settle();

		expect(camera.viewport.zoom).not.toBe(zoom);
		harness.unmount();
	});

	it('does not let the next unrelated click commit the abandoned move', async () => {
		// The same damage `onPointerCancel`'s header records, reached through the other door:
		// `SelectTool` keeps a translated preview with no button held, and the user's next
		// click anywhere commits a move by the delta between the abandoned start and it.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points;

		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		blur(canvas);
		await settle();

		click(canvas, 900, 500);
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points).toEqual(before);
		harness.unmount();
	});

	it('leaves a half-drawn polygon alone even MID-CLICK, where a gesture really is in flight', async () => {
		// The narrow half the first version of this fix got wrong, and it is reachable: a
		// drawing tool places its vertex on `pointerdown`, so a user who holds the button —
		// a long press, a notification stealing focus, an Alt+Tab without letting go — is
		// between down and up with `gestureInFlight` TRUE. `cancel()` there clears the whole
		// buffer, so an interruption during one click destroyed every vertex before it.
		//
		// `abandonGesture()` is what the interruption calls instead: each tool answers for its
		// own press-to-release transient, and a placed vertex is not one.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		pointer(canvas, 'pointerdown', 600, 200); // the third vertex placed…
		blur(canvas); // …and focus lost before the button came up
		pointer(canvas, 'pointerup', 600, 200);
		await settle();

		click(canvas, 500, 100);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('survives the pointercancel that FOLLOWS the blur, rather than losing the buffer to it', async () => {
		// The two doors deliver for one interruption, and only the first of them was careful.
		// Alt+Tab mid-press fires `blur`, which abandons the in-flight gesture without
		// touching the vertices — and the browser may then take the pointer away as well,
		// whose `pointercancel` reached `cancelGesture()` and emptied the buffer the blur had
		// just been careful to keep. The narrow fix for one door, undone by the next one along.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		pointer(canvas, 'pointerdown', 600, 200); // the third vertex placed…
		blur(canvas); // …focus lost before the button came up…
		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
		await settle();

		// …and the close still lands on all three, which two vertices could never satisfy.
		click(canvas, 500, 100);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('leaves the restored anchor on screen, instead of redrawing the segment it abandoned', async () => {
		// The ordering the first version of this handler had wrong. `abandonGesture()` puts
		// `CalibrateTool`'s first point back and redraws its zero-length anchor — and the
		// `reissuePointerMove` one line below then replayed the remembered position of the
		// interrupted SECOND point into `pointerMove`, which drew the whole segment again.
		//
		// The cost is not cosmetic, because that render is byte-identical to the one
		// `pointerDown` leaves for a second point that really WAS placed — measured here, the
		// preview and the committed segment are the same points, which is why this case takes
		// its expectation from the anchor rather than from a mid-press snapshot. A user coming
		// back therefore saw the picture that means "measured, awaiting the distance" over a
		// tool that had thrown the measurement away, with no dialog coming and nothing to say
		// why.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Calibrate').click();
		await settle();

		click(canvas, 300, 300); // the anchor: a complete click, down and up both
		await settle();
		const anchorOnly = drawnLines(harness.stage);
		expect(anchorOnly.length).toBeGreaterThan(0);

		// `buttons: 0` — the hand crosses the plan toward the second point with nothing held,
		// which is also what leaves `lastStagePoint` there for the re-issue to replay.
		pointer(canvas, 'pointermove', 500, 300, 0, 1, 0);
		pointer(canvas, 'pointerdown', 500, 300); // the second point's press…
		await settle();
		// The control, so the assertion below is a segment TAKEN DOWN rather than one that was
		// never drawn.
		expect(drawnLines(harness.stage)).not.toEqual(anchorOnly);

		blur(canvas); // …and focus lost before it came up
		await settle();

		expect(drawnLines(harness.stage)).toEqual(anchorOnly);
		harness.unmount();
	});

	it('replays the OWNER’s position on a Shift press, not a foreign pointer’s', async () => {
		// The replay path the direct foreign-move guard cannot reach. `lastStagePoint` was
		// recorded at the very top of `onPointerMove`, above every ownership check — so a pen
		// hovering during pointer A's drag was refused as a tool move one line later and
		// remembered anyway. The next Shift press then built a synthetic move out of it and
		// handed the tool exactly the coordinates the guard had just declined.
		//
		// Same shape as its predecessor, one door along: a guard on the direct path says
		// nothing about the value the direct path left behind.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 340, 300, 0, 11);
		await settle();
		const drawnBefore = drawnLines(harness.stage);
		// The control: the drag really is previewing something, so an unchanged snapshot below
		// is a preview that held still rather than a layer that never drew.
		expect(drawnBefore.length).toBeGreaterThan(0);

		// `buttons: 0` — a pen crossing the canvas, not a drag. Declined as a tool move by the
		// ownership guard, which is `canvasGestureOwnership.test.ts`'s case, not this one.
		pointer(canvas, 'pointermove', 900, 500, 0, 12, 0);
		await settle();

		key(canvas, 'keydown', { key: 'Shift', shiftKey: true });
		await settle();

		expect(drawnLines(harness.stage)).toEqual(drawnBefore);
		harness.unmount();
	});

	it('does not replay a hover the CAMERA’s gesture swallowed, once that pan has ended', async () => {
		// The half a tool-only guard leaves live, and it needed its own case: gate the record
		// on the tool's gesture alone and the whole suite still passes, because every other
		// case reaches the record through a tool. A pan swallows a foreign pointer's move —
		// so nothing jumps WHILE it runs, and the re-issue is refused outright then anyway —
		// but the swallowed position is still written down, and a pan ends on its release with
		// no move after it to correct the record. The first Shift press afterwards replays it.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		pointer(canvas, 'pointermove', 700, 300, 0, 1, 0); // the loose end, and where the hand is
		await settle();

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 700, 300, 0, 1);
		pointer(canvas, 'pointermove', 700, 300, 0, 1); // a pan that moves the camera nowhere
		// A pen crossing the canvas mid-pan. Swallowed by the pan, and recorded anyway.
		pointer(canvas, 'pointermove', 900, 500, 0, 2, 0);
		pointer(canvas, 'pointerup', 700, 300, 0, 1);
		await settle();
		const drawnBefore = drawnLines(harness.stage);
		expect(drawnBefore.length).toBeGreaterThan(0);

		// The pan owner never left (700, 300), so an honest re-issue is a no-op here and any
		// change is the pen's coordinates arriving.
		key(canvas, 'keydown', { key: 'Shift', shiftKey: true });
		await settle();

		expect(drawnLines(harness.stage)).toEqual(drawnBefore);
		harness.unmount();
	});

	it('stays hands-off when BOTH blur listeners fire for one Alt+Tab', async () => {
		// The element's `blur` and the window's are registered together on purpose — Chromium
		// can deactivate a window while leaving the focused element focused, so neither alone
		// is guaranteed — and `swallowedPointers`' docblock calls the cleanup idempotent.
		// It was not. The first call skips the re-issue because a pan is running and then
		// cancels that pan; the second call finds the override idle and replays the pan's own
		// pointer into the tool, so whether the tool hears anything came down to how many
		// blur events the host chose to deliver.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		pointer(canvas, 'pointermove', 600, 200, 0, 1, 0);
		await settle();
		const drawnBefore = drawnLines(harness.stage);
		expect(drawnBefore.length).toBeGreaterThan(0);

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 900, 500, 0, 1);
		pointer(canvas, 'pointermove', 900, 500, 0, 1); // a pan that moves the camera nowhere
		blur(canvas);
		window.dispatchEvent(new FocusEvent('blur'));
		await settle();

		expect(drawnLines(harness.stage)).toEqual(drawnBefore);
		harness.unmount();
	});

	it('keeps the coordinate readout, which focus loss says nothing about', async () => {
		// The asymmetry in that cleanup, and it needed a case: clearing `editor.setPointer`
		// beside the remembered point passes the whole suite otherwise. The two doors that DO
		// clear both — `pointerleave` and `pointercancel` — fire because the pointer
		// demonstrably left or was taken. Focus can leave this container with the pointer still
		// resting over the plan (a click on the Inspector does it), so blanking the status
		// bar's coordinates there is a visible falsehood about a pointer that has not moved.
		const { harness, canvas, camera } = await editor();
		pointer(canvas, 'pointermove', 600, 200, 0, 1, 0);
		await settle();
		const readout = camera.pointerWorld;
		expect(readout).not.toBeNull();

		blur(canvas);
		await settle();

		expect(camera.pointerWorld).toEqual(readout);
		harness.unmount();
	});

	it('hands the active tool nothing when the focus is lost mid-PAN', async () => {
		// The same replay reaching the same door from the camera's side. `reissuePointerMove`
		// refuses to run while a pan does — `lastStagePoint` is then the PAN's own pointer, and
		// a drawing tool's rubber band has no business jumping to it — but this handler
		// cancelled the pan FIRST, so that guard was already false by the time the re-issue
		// asked it. The one door built to keep a synthetic move out of a running pan was the
		// one door that walked around it.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		pointer(canvas, 'pointermove', 600, 200, 0, 1, 0); // where the rubber band is left
		await settle();

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 900, 500);
		// A pan move at the press's own pixel: the camera cannot have moved, so a changed
		// snapshot below is the TOOL having been told something rather than the view shifting
		// under it.
		pointer(canvas, 'pointermove', 900, 500);
		await settle();
		const drawnBefore = drawnLines(harness.stage);
		expect(drawnBefore.length).toBeGreaterThan(0);

		blur(canvas);
		await settle();

		expect(drawnLines(harness.stage)).toEqual(drawnBefore);
		harness.unmount();
	});

	it('leaves a half-drawn polygon alone, because no gesture was interrupted', async () => {
		// The over-correction this file exists to refuse, and the reason the cleanup is gated
		// rather than unconditional: between two complete clicks nothing is in flight, and a
		// user who alt-tabs to check a measurement must come back to their vertices.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);
		blur(canvas);
		await settle();

		// The buffer survived: a third vertex and a close land on the original two.
		click(canvas, 600, 200);
		click(canvas, 500, 100);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});
});
