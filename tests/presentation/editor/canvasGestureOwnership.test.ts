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
import { chord, click, pointer, rig, toolbarButton } from '../../helpers/planEditorRig';
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
