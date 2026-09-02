/**
 * @vitest-environment jsdom
 *
 * WHOSE gesture is it, and one at a time — the rule the whole of this canvas's pointer
 * routing turned out to rest on, and the one every round of review on it found another hole
 * in.
 *
 * Split out of `canvasNavigation.test.ts` when that file crossed the suite's 450-line cap.
 * The boundary is a real one rather than an arbitrary halving: everything here is about a
 * gesture having exactly one owner and the canvas refusing every other input while it runs,
 * where that file is about which gestures exist at all.
 *
 * Three shapes recur, and it is worth naming them because a fix for one reads like a fix for
 * all three and is not:
 *
 * 1. **A mouse shares ONE `pointerId` across every button**, so button identity and pointer
 *    identity are different questions.
 * 2. **Camera mode has the same shape as the pan override** — it is the DEFAULT state, so a
 *    fix applied only to the override leaves the more reachable half broken.
 * 3. **A swallowed press owes a swallowed release.** Consuming one end and forwarding the
 *    other hands a tool a release with no matching press, which is the event-grammar defect
 *    `canvasPointerRouting.test.ts` already exists for.
 *
 * What a second BUTTON does while another is held is `canvasChordedButtons.test.ts`, split
 * out when this file crossed the cap — a different device grammar, and the one this suite
 * spent eight review rounds getting wrong.
 */
import { describe, expect, it } from 'vitest';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { settle } from '../../helpers/editor';
import { chord, click, drawnLines, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
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
 * Only the CLASS is assertable — jsdom resolves no styles, so nothing in this suite can see
 * that `.rp-plan-canvas-armed` means `cursor: grab`. What the cases below DO hold is the
 * precedence, which is decided in the component precisely so that it can be: expressed as
 * source order in a stylesheet it would be a correct rule that no gate reads.
 */
function cursorClasses(canvas: HTMLElement): string[] {
	return [...canvas.classList].filter((name) => name.startsWith('rp-plan-canvas-'));
}

it('does not let a foreign pointer’s MOVE steer the owner’s preview', async () => {
	// The move door, which the press guard above does not reach: a pen HOVERING over the
	// canvas is never pressed, so it is in no swallowed set — it simply arrives. Its
	// coordinates went straight into `SelectTool.pointerMove`, and the ghost the user is
	// steering by jumped to wherever the pen was. The commit is computed from the release,
	// so the geometry survives and the PREVIEW is the whole of the damage — which is why
	// this asserts on what is drawn rather than on what is saved.
	const { harness, canvas } = await editor();
	toolbarButton(harness, 'Select').click();
	await settle();

	pointer(canvas, 'pointerdown', 300, 300, 0, 11);
	pointer(canvas, 'pointermove', 400, 300, 0, 11);
	await settle();
	const drawnBefore = drawnLines(harness.stage);
	// The control: the drag really is previewing something, so an unchanged snapshot below
	// is a preview that held still rather than a layer that never drew.
	expect(drawnBefore.length).toBeGreaterThan(0);

	// `buttons: 0` — a hover, not a drag. The default would have spelled a held primary
	// button, which is not what a pen crossing the canvas sends.
	pointer(canvas, 'pointermove', 900, 500, 0, 12, 0);
	await settle();

	expect(drawnLines(harness.stage)).toEqual(drawnBefore);
	harness.unmount();
});

describe('a pan the pointer walks out of', () => {
	it('hands the active tool its input back, instead of swallowing every later release', async () => {
		// `pointerleave` ended the camera's own drag and left the override still believing it
		// owned the gesture — two values modelling one thing, disagreeing. The camera itself
		// then looked fine, because `continuePan` no-ops without a drag state; what broke was
		// the ROUTING. Every later `pointerup` was consumed as the end of that phantom pan, so
		// `SelectTool` got presses it never got releases for and no drag ever committed again.
		//
		// Pointer capture means a real browser should not deliver this mid-drag at all. That
		// is a reason for the two to agree anyway, not a reason to leave the gap.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points[0].x;

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		// `pointerId: 1` is the rig's own default for `pointer()`, so this leave carries the
		// OWNER's identity — which a real one does, and which an omitted id (defaulting to 0)
		// would not.
		canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 1, bubbles: false }));
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		// An ordinary select-and-drag, as the very NEXT interaction. It has to be the next one:
		// the phantom pan swallows exactly one release and is cleared by doing so, so any
		// click in between absorbs the damage and this case would pass against the defect.
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points[0].x).not.toBe(before);
		harness.unmount();
	});

	it('goes back to ARMED, so the held space bar is not thrown away with it', async () => {
		// `pointerUp` rather than `cancel`: the user never released the key, and disarming
		// would make them press it again for a gesture they are still in the middle of asking
		// for.
		const { harness, canvas } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 1, bubbles: false }));
		await settle();

		expect(cursorClasses(canvas)).toEqual(['rp-plan-canvas-armed']);
		harness.unmount();
	});
});

describe('a second finger on a touch device', () => {
	/**
	 * On a mouse this can never happen — one `pointerId` is shared across every button — so
	 * these two are about touch and pen. The manifest promises mobile
	 * (`isDesktopOnly: false`), and a tablet with a hardware keyboard can hold space and then
	 * put a second finger down.
	 */
	const FIRST = 11;
	const SECOND = 12;

	it('does not drive a pan it did not start', async () => {
		// Without an owner, the second finger's move was read as a continuation of the first
		// one's drag — so the camera jumped by the distance between two fingers rather than
		// by how far either had travelled.
		const { harness, canvas, camera } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, FIRST);
		pointer(canvas, 'pointermove', 320, 300, 0, FIRST);
		await settle();
		const afterFirst = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 700, 300, 0, SECOND);
		await settle();

		expect(camera.viewport.pan.x).toBe(afterFirst);
		harness.unmount();
	});

	it('does not end a pan its own finger is still holding', async () => {
		const { harness, canvas, camera } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, FIRST);
		pointer(canvas, 'pointerup', 300, 300, 0, SECOND);
		await settle();
		const interrupted = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 400, 300, 0, FIRST);
		await settle();

		expect(camera.viewport.pan.x).not.toBe(interrupted);
		harness.unmount();
	});
});

describe('a press arriving while a pan is already running', () => {
	it('does not reach the active tool from an ordinary MOUSE click', async () => {
		// The everyday desktop case, and the reason this is not a touch-only concern: a mouse
		// shares ONE `pointerId` across all its buttons, so during a middle-button pan a plain
		// left click is an input the canvas must keep away from the tool — and it fell straight
		// through. `DrawPolygonTool` placed a vertex the user never asked for, at a point on a
		// world that was moving under them.
		//
		// **Where that press ARRIVES is the part the first version of this case got wrong.**
		// The middle button is already down, so the left click is two chords rather than a
		// press and a release: it never reaches `onPointerDown` at all, and what keeps it from
		// the tool is the move handler returning early while a pan owns the canvas. The stream
		// below is the one a mouse really sends; the vertex count is what it is asserted on
		// either way.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		pointer(canvas, 'pointerdown', 300, 300, 1); // middle: the pan begins
		pointer(canvas, 'pointermove', 340, 300, 1);
		chord(canvas, 340, 300, 0, 5); // a left click on top of it: pressed…
		chord(canvas, 340, 300, 0, 4); // …and released, the middle button still down
		pointer(canvas, 'pointerup', 360, 300, 1);
		await settle();

		// Three deliberate vertices, then a close click on the first.
		click(canvas, 500, 500);
		click(canvas, 600, 500);
		click(canvas, 600, 600);
		click(canvas, 500, 500);
		await settle();

		// Exactly one zone was drawn — from the three deliberate clicks — not a four-sided one
		// carrying the stray vertex.
		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).loaded.find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('does not let a second finger start a tool gesture during a touch pan', async () => {
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points;

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 320, 300, 0, 11);
		// A second finger presses on the zone and drags it.
		pointer(canvas, 'pointerdown', 300, 300, 0, 12);
		pointer(canvas, 'pointermove', 500, 300, 0, 12);
		pointer(canvas, 'pointerup', 500, 300, 0, 12);
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points).toEqual(before);
		harness.unmount();
	});
});

describe('a pointer leaving the pane while another one pans', () => {
	it('does not abandon a gesture it does not own', async () => {
		// `pointerleave` carries an identity and the handler discarded it, so a second touch or
		// pen crossing the pane edge stopped a drag the owner's finger was still making.
		const { harness, canvas, camera } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 320, 300, 0, 11);
		await settle();
		const afterFirst = camera.viewport.pan.x;

		canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 12, bubbles: false }));
		pointer(canvas, 'pointermove', 400, 300, 0, 11);
		await settle();

		expect(camera.viewport.pan.x).not.toBe(afterFirst);
		harness.unmount();
	});

	it('still ends the gesture when its OWN pointer leaves', async () => {
		const { harness, canvas, camera } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 320, 300, 0, 11);
		canvas.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 11, bubbles: false }));
		await settle();
		const afterLeave = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 500, 300, 0, 11);
		await settle();

		expect(camera.viewport.pan.x).toBe(afterLeave);
		harness.unmount();
	});
});

describe('a pointer taken away mid-pan', () => {
	it('does not destroy the half-drawn polygon the override exists to protect', async () => {
		// This PR's central claim, and `pointercancel` was the one door that broke it. The
		// handler cancelled the ACTIVE TOOL unconditionally — but the tool never received the
		// pan's press, so its buffer has nothing to do with the gesture the OS just took away.
		// A user mid-polygon who holds space to pan and then alt-tabs lost their vertices.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		click(canvas, 600, 100);

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 400, 400);
		pointer(canvas, 'pointermove', 420, 420);
		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
		key(canvas, 'keyup', { key: ' ' });
		await settle();

		// The buffer survived: a third vertex and a close land on the original two, at the
		// screen positions the pan moved them to.
		click(canvas, 620, 220);
		click(canvas, 520, 120);
		await settle();

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).loaded.find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('still abandons the pan itself', async () => {
		// The half that must keep working: no `pointerup` will ever arrive for a cancelled
		// pointer, so a pan left running would follow the bare cursor forever.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
		await settle();
		const afterCancel = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 600, 300);
		await settle();

		expect(camera.viewport.pan.x).toBe(afterCancel);
		harness.unmount();
	});

	it('still ends a CAMERA-MODE drag, which neither a tool nor the override owns', async () => {
		// The arm that keeps the cancel door's ownership test from being spelled as bare
		// identity. Camera mode is the DEFAULT state and its drag is recorded in the store
		// alone — no tool flag, and the override never claimed it — so `toolGesturePointer` is
		// null throughout. Asked as `toolGesturePointer !== event.pointerId`, this cancellation
		// is refused, `endPan` never runs, and the drag follows the bare cursor for the rest of
		// the session. The whole suite passes against that version, which is why this exists.
		const { harness, canvas, camera } = await editor();
		// Camera mode, and no space either — the store's own drag. Task 10 made Select the
		// tool a ready plan opens onto, so this reaches camera mode through the Pan button
		// rather than through the pre-Task-10 default.
		toolbarButton(harness, 'Pan').click();
		await settle();
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
		await settle();
		const afterCancel = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 600, 300);
		await settle();

		expect(camera.viewport.pan.x).toBe(afterCancel);
		harness.unmount();
	});

	it('leaves the OWNER’s coordinate readout alone when a foreign pointer is cancelled', async () => {
		// The other half of the same guard, and it needed its own case too: leave the tail
		// outside it — guarding the abandonment alone — and the suite still passes while a
		// hovering pen taken away by the OS blanks the status bar and forgets where the
		// drawing hand is. A foreign pointer's cancellation is not news about the owner's.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 340, 300, 0, 11);
		await settle();
		const readout = camera.pointerWorld;
		expect(readout).not.toBeNull();

		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 12, bubbles: true }));
		await settle();

		expect(camera.pointerWorld).toEqual(readout);
		harness.unmount();
	});

	it('ignores a cancellation from a pointer that owns nothing', async () => {
		const { harness, canvas, camera } = await editor();
		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 320, 300, 0, 11);
		await settle();
		const afterFirst = camera.viewport.pan.x;

		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 12, bubbles: true }));
		pointer(canvas, 'pointermove', 400, 300, 0, 11);
		await settle();

		expect(camera.viewport.pan.x).not.toBe(afterFirst);
		harness.unmount();
	});
});

describe('a Shift press during a pan', () => {
	/**
	 * While a pan runs the canvas belongs to the CAMERA — every input, and a SYNTHETIC one is
	 * still an input. Shift re-issues the pointer move so an angle constraint bites on the key
	 * rather than on the next twitch, and that re-issue is built from `lastStagePoint`, which
	 * during a pan is the PAN's own pointer. So the one door that hands a tool something while
	 * the camera owns the canvas was the door that names no pointer at all.
	 */
	it('does not move the tool’s sketch, which the pan is otherwise keeping away from it', async () => {
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		pointer(canvas, 'pointermove', 600, 200, 0, 1, 0);
		await settle();

		// Space-pan from somewhere else entirely, so a leaked re-issue is unmistakable rather
		// than a rounding difference.
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		pointer(canvas, 'pointerdown', 200, 600);
		pointer(canvas, 'pointermove', 250, 650);
		await settle();
		const drawnBefore = drawnLines(harness.stage);
		expect(drawnBefore.length).toBeGreaterThan(0);

		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }));
		await settle();

		expect(drawnLines(harness.stage)).toEqual(drawnBefore);
		harness.unmount();
	});

	it('still reaches the tool while the TOOL’s own gesture is in flight', async () => {
		// The narrowing, and it needs its own case for the same reason the last one did: the
		// suppression above passes every test in this suite if it is widened from "a pan is
		// running" to "any gesture is running" — and that version kills the angle constraint at
		// exactly the moment it is wanted. A drawing tool places its vertex on `pointerdown`, so
		// a user who holds the button and moves is mid-gesture by definition, and Shift is what
		// they press to straighten the line they are already drawing.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		// Pressed and HELD: the second vertex is placed and the gesture is in flight.
		pointer(canvas, 'pointerdown', 600, 120);
		pointer(canvas, 'pointermove', 700, 140);
		await settle();
		const drawnBefore = drawnLines(harness.stage);
		expect(drawnBefore.length).toBeGreaterThan(0);

		// About 11 degrees off horizontal, so the 15-degree constraint has somewhere to move it.
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }));
		await settle();

		expect(drawnLines(harness.stage)).not.toEqual(drawnBefore);
		harness.unmount();
	});

	/**
	 * **A pan can END without the pointer being released, and the door it ends at forgot half
	 * of what the other three clear.** `onPointerCancel`'s pan branch blanked the status bar's
	 * coordinates and left `lastStagePoint` holding the PAN's own pointer — so the suppression
	 * above, which is a `phase === 'panning'` test, stopped applying the moment the phase went
	 * and the next Shift press replayed the panning cursor into the tool. The same defect the
	 * blur-ordering commit fixed at `onBlur`, at the one door that was not re-read against it,
	 * and `onBlur`'s own docblock names this handler as already carrying the sentence.
	 *
	 * A cancellation rather than a release, deliberately: a pan that ends on `pointerup` has a
	 * real pointer position behind it, while one the OS takes away leaves a remembered point
	 * that is no longer a claim about where the user's pointer is.
	 */
	it('forgets the pan’s cursor when the pan is CANCELLED rather than released', async () => {
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100);
		pointer(canvas, 'pointermove', 600, 200, 0, 1, 0);
		await settle();

		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 900, 500);
		await settle();
		const drawnBefore = drawnLines(harness.stage);
		expect(drawnBefore.length).toBeGreaterThan(0);

		// The OS takes the pan's pointer: no `pointerup` is ever coming, and the phase clears.
		canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }));
		await settle();

		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }));
		await settle();

		expect(drawnLines(harness.stage)).toEqual(drawnBefore);
		harness.unmount();
	});
});

describe('a second pointer arriving during a TOOL gesture', () => {
	/**
	 * The pan override refuses a press while another gesture runs, camera mode's `beginPan`
	 * keeps the drag it already has — and the TOOL branch had neither, so it was the one door
	 * left where a newcomer could take a gesture away from its owner.
	 *
	 * Touch and pen only, for the reason this file's header gives: a second finger has its own
	 * `pointerId` and fires its own press, while a mouse cannot produce one at all mid-drag —
	 * a chorded button arrives as a `pointermove`. The manifest promises mobile, so this is a
	 * device the plugin claims to support rather than a hypothetical.
	 *
	 * `gestureInFlight` and not "a tool is active" is the gate, deliberately: a multi-click
	 * tool sits BETWEEN clicks with nothing in flight, and two fingers tapping vertices in
	 * turn is a legitimate way to draw a polygon.
	 */
	async function dragWithZoneSelected(interloper: boolean, cancelFrom?: number): Promise<number> {
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points[0].x;

		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 400, 300, 0, 11);
		if (interloper) {
			// A second finger lands far away on empty canvas and lifts again.
			pointer(canvas, 'pointerdown', 900, 500, 0, 12);
			pointer(canvas, 'pointerup', 900, 500, 0, 12);
		}
		if (cancelFrom !== undefined) {
			canvas.dispatchEvent(new PointerEvent('pointercancel', { pointerId: cancelFrom, bubbles: true }));
		}
		pointer(canvas, 'pointerup', 400, 300, 0, 11);
		await settle();

		const after = expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points[0].x;
		harness.unmount();
		return after - before;
	}

	it('still follows a foreign pointer when NO gesture is in flight', async () => {
		// The narrowing, and it needs its own case because every other one here passes without
		// it: `toolGesturePointer` is deliberately never cleared, so a guard keyed on identity
		// ALONE would stop a drawing tool's rubber band following any pointer but the last one
		// to have pressed — for the rest of the session, silently. A multi-click tool sits
		// between clicks with nothing in flight, and a hover is how its loose end moves at all.
		const { harness, canvas } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		click(canvas, 500, 100); // a complete click: pointer 1 owns nothing afterwards
		pointer(canvas, 'pointermove', 600, 200, 0, 1, 0);
		await settle();
		const drawnBefore = drawnLines(harness.stage);
		expect(drawnBefore.length).toBeGreaterThan(0);

		// A different pointer takes over the hover — a pen picked up after a finger tap.
		pointer(canvas, 'pointermove', 900, 500, 0, 12, 0);
		await settle();

		expect(drawnLines(harness.stage)).not.toEqual(drawnBefore);
		harness.unmount();
	});

	it('survives a FOREIGN pointer being cancelled out from under it', async () => {
		// The cancel door, which the press and move doors already guard. A hovering pen taken
		// away by the OS — palm rejection, or leaving digitizer range — was never pressed, so
		// it is in no swallowed set and simply arrives; the handler then abandoned the gesture
		// of the pointer that IS drawing. `SelectTool`'s preview snapped back and the owner's
		// own release could no longer commit it.
		//
		// The comment deferring this said `ToolManager` tracks no pointer identity, so
		// widening it was its contract to change — true when written, and no longer the whole
		// story: `toolGesturePointer` lives in this file and the move door reads it.
		const undisturbed = await dragWithZoneSelected(false);
		expect(undisturbed).not.toBe(0);

		expect(await dragWithZoneSelected(false, 12)).toBe(undisturbed);
	});

	it('commits the owner’s drag, not the newcomer’s coordinates', async () => {
		// Measured against an undisturbed drag rather than a spelled-out world delta, so the
		// case says what it means — the interloper changes nothing — without pinning the
		// fixture's zoom. The control is asserted to be a REAL move first: two drags that both
		// went nowhere would agree perfectly and prove nothing, which is the vacuous-absence
		// trap this suite has already paid for once.
		const undisturbed = await dragWithZoneSelected(false);
		expect(undisturbed).not.toBe(0);

		expect(await dragWithZoneSelected(true)).toBe(undisturbed);
	});
});

describe('the camera during a tool drag', () => {
	/**
	 * `SelectTool` records where a drag STARTED in world coordinates and computes the commit
	 * from the release's world coordinate — both converted through the camera as it stands at
	 * that moment. So a camera that moves mid-drag silently adds its own delta to the geometry
	 * the user is committing, and nothing anywhere reports it.
	 *
	 * The middle-button path already refuses to pan in this state. These cases extend that
	 * same refusal to every other camera door, which is the rule the file was already half
	 * applying.
	 */
	async function draggingZone() {
		const built = await editor();
		toolbarButton(built.harness, 'Select').click();
		await settle();
		const before = expectOk(await built.zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points[0].x;
		pointer(built.canvas, 'pointerdown', 300, 300);
		pointer(built.canvas, 'pointermove', 350, 300);
		return { ...built, before };
	}

	it('does not let shift+wheel move it', async () => {
		const { harness, canvas, camera } = await draggingZone();
		const pan = camera.viewport.pan;

		canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, shiftKey: true, bubbles: true, cancelable: true }));
		await settle();

		expect(camera.viewport.pan).toEqual(pan);
		harness.unmount();
	});

	it('does not let the wheel zoom it either', async () => {
		// Not named by the finding, and older than this change: slice 5's wheel zoom has always
		// been able to do this. Half-fixing a class is how the same defect comes back wearing a
		// different hat, which this review has already demonstrated twice.
		const { harness, canvas, camera } = await draggingZone();
		const zoom = camera.viewport.zoom;

		canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -200, bubbles: true, cancelable: true }));
		await settle();

		expect(camera.viewport.zoom).toBe(zoom);
		harness.unmount();
	});

	it('does not let a fit shortcut jump it', async () => {
		const { harness, canvas, camera } = await draggingZone();
		const viewport = camera.viewport;

		canvas.dispatchEvent(new KeyboardEvent('keydown', {
			key: '!', code: 'Digit1', shiftKey: true, bubbles: true, cancelable: true,
		}));
		await settle();

		expect(camera.viewport).toEqual(viewport);
		harness.unmount();
	});

	it('commits the pointer’s own delta, not the pointer’s plus the camera’s', async () => {
		// The consequence, asserted on the persisted geometry rather than on the camera: at the
		// default zoom of 0.1 a 100px drag is 1000 world millimetres, and a camera that moved
		// under it would commit some other number entirely.
		const { harness, canvas, zonesRepo, before } = await draggingZone();

		canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, shiftKey: true, bubbles: true, cancelable: true }));
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settle();

		const after = expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points[0].x;
		expect(after).toBeCloseTo(before + 1000, 6);
		harness.unmount();
	});
});

describe('the camera during a CAMERA-MODE drag', () => {
	/**
	 * Camera mode — no tool — is the default state, and its drag lives only in
	 * `editor.dragState`: no tool flag, and the override never claimed it. So the lock added
	 * for tool drags did not see it, even though the override-start guard three lines away
	 * already asked exactly this question. The third instance in this review of a rule stated
	 * in one place and not followed by the next.
	 *
	 * The symptom is a JUMP rather than a silent corruption: `continuePan` recomputes
	 * absolutely from the viewport the drag captured at its start, so a wheel that moved the
	 * camera mid-drag is thrown away by the very next mouse move.
	 */
	async function panningTheCamera() {
		const built = await editor();
		// Task 10 made Select the tool a ready plan opens onto; back to camera mode so this
		// bare primary drag pans rather than dragging zone-a, which sits under (300, 300).
		toolbarButton(built.harness, 'Pan').click();
		await settle();
		pointer(built.canvas, 'pointerdown', 300, 300);
		pointer(built.canvas, 'pointermove', 350, 300);
		await settle();
		return built;
	}

	it('does not let shift+wheel move it', async () => {
		const { harness, canvas, camera } = await panningTheCamera();
		const pan = camera.viewport.pan;

		canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, shiftKey: true, bubbles: true, cancelable: true }));
		await settle();

		expect(camera.viewport.pan).toEqual(pan);
		harness.unmount();
	});

	it('does not let a fit shortcut jump it', async () => {
		const { harness, canvas, camera } = await panningTheCamera();
		const viewport = camera.viewport;

		canvas.dispatchEvent(new KeyboardEvent('keydown', {
			key: '!', code: 'Digit1', shiftKey: true, bubbles: true, cancelable: true,
		}));
		await settle();

		expect(camera.viewport).toEqual(viewport);
		harness.unmount();
	});
});

describe('a foreign pointer hovering during a tool drag', () => {
	/**
	 * The chorded-release fix reads `event.buttons` to notice that a drag's own button came up
	 * inside a chord — and asked nothing about WHOSE pointer reported it. A pen hovering, or a
	 * finger resting and lifted, sends a move with `buttons === 0` while the mouse holding the
	 * drag is still down, so the canvas read a foreign hover as the owner's release.
	 *
	 * This file's shape 1, from the side the chord work reopened: **a gesture belongs to a
	 * POINTER, not just to a button.** Invisible on a mouse, where one `pointerId` is shared
	 * across everything; the manifest promises mobile, and a pen and a mouse coexist on a
	 * tablet by design.
	 */
	it('does not commit the drag at the hovering pointer’s coordinates', async () => {
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points;

		pointer(canvas, 'pointerdown', 300, 300, 0, 11); // the mouse grabs zone-a
		pointer(canvas, 'pointermove', 340, 300, 0, 11);
		pointer(canvas, 'pointermove', 900, 500, 0, 12, 0); // a pen hovers, nothing held
		await settle();

		// The drag is still the mouse's: nothing committed at the pen's position.
		expect(expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points).toEqual(before);
		harness.unmount();
	});

	it('still lets the OWNER’s own chorded release commit it', async () => {
		// The other direction, so the fix cannot be "ignore every move reporting no buttons":
		// the owning pointer saying its button is up is exactly the case the branch exists for.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points;

		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 420, 300, 0, 11);
		pointer(canvas, 'pointermove', 900, 500, 0, 12, 0); // the pen hovers past, ignored
		chord(canvas, 420, 300, 1, 5, 11); // middle pressed on the owner
		chord(canvas, 440, 300, 0, 4, 11); // the owner's PRIMARY released
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN)).loaded[0].entity.geometry.points).not.toEqual(before);
		harness.unmount();
	});
});
