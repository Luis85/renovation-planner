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
 *    identity are different questions and a press during a middle-drag pan is an everyday
 *    desktop input rather than an exotic touch one.
 * 2. **Camera mode has the same shape as the pan override** — it is the DEFAULT state, so a
 *    fix applied only to the override leaves the more reachable half broken.
 * 3. **A swallowed press owes a swallowed release.** Consuming one end and forwarding the
 *    other hands a tool a release with no matching press, which is the event-grammar defect
 *    `canvasPointerRouting.test.ts` already exists for.
 */
import { describe, expect, it } from 'vitest';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { settle } from '../../helpers/editor';
import { click, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
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
		const before = expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points[0].x;

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

		expect(expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points[0].x).not.toBe(before);
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

describe('a second mouse button pressed during a pan', () => {
	it('does not end the pan when it is the one released first', async () => {
		// A mouse shares one `pointerId` across its buttons, so this is an ordinary input: the
		// user is space-dragging and reflexively clicks the middle button. An unconditional
		// release would stop the camera while the primary button is still down — the view
		// freezes under a hand that is still moving.
		//
		// The frozen camera is the whole of the observable damage, MEASURED rather than
		// assumed: the second-order consequence — the eventual primary release reaching
		// `SelectTool` as a release with no matching press — is absorbed by that tool's own
		// no-gesture guard, so a case asserting the zone did not move passes with the defect
		// present and was dropped rather than kept. That guard is where the invariant belongs
		// (it holds for tools not yet written); this case is what holds the routing.
		const { harness, canvas, camera } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		pointer(canvas, 'pointerdown', 340, 300, 1);
		pointer(canvas, 'pointerup', 340, 300, 1);
		await settle();
		const interrupted = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 420, 300);
		await settle();

		expect(camera.viewport.pan.x).not.toBe(interrupted);
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
		// left click is simply a press the override declines — and it fell straight through to
		// the tool. `DrawPolygonTool` placed a vertex the user never asked for, at a point on a
		// world that was moving under them.
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Draw zone').click();
		await settle();

		pointer(canvas, 'pointerdown', 300, 300, 1); // middle: the pan begins
		pointer(canvas, 'pointermove', 340, 300, 1);
		pointer(canvas, 'pointerdown', 340, 300, 0); // a left click on top of it
		pointer(canvas, 'pointerup', 340, 300, 0);
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
		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('does not let a second finger start a tool gesture during a touch pan', async () => {
		const { harness, canvas, zonesRepo } = await editor();
		toolbarButton(harness, 'Select').click();
		await settle();
		const before = expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points;

		key(canvas, 'keydown', { key: ' ' });
		pointer(canvas, 'pointerdown', 300, 300, 0, 11);
		pointer(canvas, 'pointermove', 320, 300, 0, 11);
		// A second finger presses on the zone and drags it.
		pointer(canvas, 'pointerdown', 300, 300, 0, 12);
		pointer(canvas, 'pointermove', 500, 300, 0, 12);
		pointer(canvas, 'pointerup', 500, 300, 0, 12);
		await settle();

		expect(expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points).toEqual(before);
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

		const drawn = expectOk(await zonesRepo.listByPlan(PLAN)).find((l) => l.entity.id !== 'zone-a');
		expect(drawn?.entity.geometry.points).toHaveLength(3);
		harness.unmount();
	});

	it('does not destroy it when ESCAPE arrives mid-pan either', async () => {
		// The same door one input over, and the destructive one: `cancelGesture()` empties the
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

describe('the middle button pressed during a camera-mode drag', () => {
	it('does not kill a primary drag whose button is still held', async () => {
		// Camera mode is the DEFAULT — no tool — so this is a bare left-drag pan with a middle
		// click on top of it. The override's refusal only asked whether a TOOL was mid-gesture,
		// and camera mode is not a tool: so the middle press claimed the gesture, `beginPan`
		// kept the existing drag (one at a time), and the middle RELEASE then ended a drag the
		// primary button was still holding. Same mouse, same `pointerId`, so nothing about
		// pointer identity could catch it.
		const { harness, canvas, camera } = await editor();
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 340, 300);
		await settle();

		pointer(canvas, 'pointerdown', 340, 300, 1);
		pointer(canvas, 'pointerup', 340, 300, 1);
		await settle();
		const afterMiddle = camera.viewport.pan.x;

		pointer(canvas, 'pointermove', 500, 300);
		await settle();

		expect(camera.viewport.pan.x).not.toBe(afterMiddle);
		harness.unmount();
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
		const before = expectOk(await built.zonesRepo.listByPlan(PLAN))[0].entity.geometry.points[0].x;
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

		const after = expectOk(await zonesRepo.listByPlan(PLAN))[0].entity.geometry.points[0].x;
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
