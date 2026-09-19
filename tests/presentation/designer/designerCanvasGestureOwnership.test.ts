/**
 * @vitest-environment jsdom
 *
 * **The designer mounts `EditorSurface` with its interruption doors WIRED**, asked through the DOM
 * rather than through the tool object.
 *
 * `DesignerCanvas.vue` delegates every pointer, wheel and key door to `EditorSurface` — its own
 * docblock's *"`EditorSurface` is shared, not copied"* — so the doors themselves are the plan
 * editor's subject (`tests/presentation/editor/canvasGestureOwnership.test.ts` dispatches the
 * `pointercancel`, `canvasKeyboardGestures.test.ts` the window `blur`).
 *
 * **What was missing is narrower than "the wiring", and the narrow claim is the true one.** The
 * first version of this header said a drop or a mis-bind in `DesignerCanvas.vue` left both
 * surfaces' suites green, and that is false as written: `designerMarqueeCanvas.test.ts` already
 * dispatches real `PointerEvent`s at `rig.canvasEl` and asserts `assetDesignStore.selected`, and
 * `designerEscapeRouting.test.ts` already dispatches a real `keydown` Escape at the same element
 * and asserts the routing — so a press and a key already travel through the props this component
 * hands `EditorSurface`, and a mis-bind is already red somewhere. What had no designer-side
 * dispatch at all is the three INTERRUPTION doors.
 *
 * Written from a grep rather than from memory, and narrow to what it printed: before this file,
 * `grep -rn pointercancel tests/presentation/designer/` reached no dispatch at all — two prose
 * mentions and one test TITLE (`designerSelectMarquee.test.ts`'s *"pointercancel, blur or a release
 * outside the leaf"*, over a direct `tool.abandonGesture()` call). `grep -rn blur` over the same
 * directory printed thirteen hits, of which every DISPATCH — five — was an `input.trigger('blur')`
 * on a number field in the Inspector or the dimensions form, never the canvas; the other eight were
 * five test titles and three prose comments. The mapping was a label, which is prose and not an
 * assertion.
 *
 * So the subject here is the CHAIN and not the tool: a real event at the real mounted element,
 * observed through what `DesignerSelectTool.abandonGesture` leaves behind — the band gone from the
 * Konva stage, and the selection the press cleared put back. Both halves are asserted and both were
 * watched failing on their own: the band against each door disabled in turn, the restore against
 * `dropMarquee(context, false)`.
 *
 * **The last two cases in that block are about what the interruption UNLOCKS rather than what it
 * tidies away**, and they are the ones that ask whether the event was heard at all.
 * `cancelInterruptedGesture()` is what clears `ToolManager`'s `#gestureInFlight`, and
 * `EditorSurface` returns early on `gestureInFlight()` at its wheel door and again in
 * `./keyDoors.ts` — so a sweep whose interruption is never heard leaves the camera and the keyboard
 * refused for the rest of the session, with the band already gone and nothing on screen to say why.
 * The three cases above them read state the TOOL cleared; these two read doors the MANAGER
 * reopened, one each, because the two doors are separate expressions in separate modules and a
 * change can drop either alone.
 *
 * **The file's last `describe` is the only case whose SUBJECT is that a release outside the leaf
 * COMMITS**, which is a narrower sentence than the one written first — *"the one thing here that is
 * not an interruption"* — and narrower because that one is falsifiable three lines into the block
 * above. Every interruption row is seeded by `drag(rig, FROM, TO)`, whose release lands at screen
 * (-52, -52) and therefore outside the pane; it commits, and `expect(swept).toHaveLength(2)` is the
 * assertion that says so. So an outside release is already load-bearing here and always was — what
 * was missing is a case that NAMES it, against `DesignerSelectTool.dropMarquee`'s docblock, which
 * corrected the opposite claim. That case's own docblock carries what jsdom's missing pointer
 * capture lets it check and what it therefore does not claim.
 *
 * **A case was written and dropped rather than shipped quietly**: *"the press after a cancellation
 * is an ordinary one"* stayed GREEN with the `pointercancel` door disabled, because the next press
 * drops a stale marquee itself before doing anything else. It asserted nothing this file does not
 * already assert, so there is nothing here about the gesture AFTER the interruption. That is a
 * different question from the one below, which is about the gesture never having ended.
 *
 * **No `pointerup` follows any of the three**, and that is the grammar rather than a shortcut a rig
 * rule would refuse: a cancellation IS the end of that pointer, and a focus loss is exactly the
 * gesture whose release the user makes in another application.
 *
 * The pragma is load-bearing rather than conventional — `vitest.config.ts` defaults to `node`, and
 * this file mounts the real designer through `designerRig`.
 */
import { describe, expect, it } from 'vitest';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { band, drag, FROM, held, selecting, SHORT, TO, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

/**
 * A zoom at the pane's own coordinates: a nonzero `deltaY` and no `shiftKey`, which is what
 * `onWheel` routes to the zoom branch rather than to the horizontal pan one.
 */
function wheel(rig: DesignerRig): void {
	const at = rig.at(FROM);
	rig.canvasEl.dispatchEvent(
		new WheelEvent('wheel', { deltaX: 0, deltaY: -100, clientX: at.x, clientY: at.y, bubbles: true, cancelable: true }),
	);
}

/**
 * The `+` key at the canvas, which `canvasKeyDoors`' `onKeyDown` routes to `zoomShortcut` — the
 * statement the one short-circuit chain GUARDS rather than a branch of it, reached only once
 * `gestureInFlight()` answers false, and so the cheapest observable thing on the far side of that
 * arm.
 *
 * Dispatched AT `rig.canvasEl` because `isCanvasKey` tests `event.target === container`: these
 * shortcuts belong to the canvas only while the canvas is what has focus.
 */
function zoomKey(rig: DesignerRig): void {
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
}

/**
 * The three real inputs `EditorSurface` maps onto `ToolManager.cancelInterruptedGesture()`, each
 * fired as the host fires it and at the node the host fires it on.
 *
 * `blur` does NOT bubble, which is what keeps the second and third apart as instruments: the
 * container's own handler is the template's `@blur`, the window's is the `listenOnOwner`
 * registration `onMounted` makes because Chromium can deactivate a window while leaving the
 * focused element focused. Dispatching one never exercises the other.
 */
const INTERRUPTIONS: readonly (readonly [string, (rig: DesignerRig) => void])[] = [
	['the pointer is taken away', (rig): void => held(rig, 'pointercancel', SHORT, 0)],
	['the canvas loses focus', (rig): void => { rig.canvasEl.dispatchEvent(new FocusEvent('blur')); }],
	['the window loses focus', (): void => { window.dispatchEvent(new Event('blur')); }],
];

describe('an interrupted designer gesture, interrupted through the DOM', () => {
	it.each(INTERRUPTIONS)('takes the band away and puts the selection back: %s', async (_name, interrupt) => {
		const rig = await selecting();
		// A first sweep, so there is a selection for the second one's press to clear and its
		// abandonment to restore. `drag` is the rig's own down/move/up, so this one really ended.
		drag(rig, FROM, TO);
		await settle();
		const swept = useAssetDesignStore(rig.pinia).selected;
		expect(swept).toHaveLength(2);
		const before = await rig.document();

		// The second sweep, left running: a press on empty canvas clears the set, a move past the
		// threshold draws the band, and no release is ever sent.
		held(rig, 'pointerdown', FROM, 1);
		held(rig, 'pointermove', SHORT, 1);
		await settle();
		expect(band(rig)).toBeDefined();
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([]);

		interrupt(rig);
		await settle();

		expect(band(rig)).toBeUndefined();
		expect(useAssetDesignStore(rig.pinia).selected).toEqual(swept);
		// A cancelled sweep is no command and no history entry (AD08's "Escape/pointercancel is none").
		expect(await rig.document()).toEqual(before);
		rig.unmount();
	});

	/**
	 * The camera is refused WHILE the sweep runs and free once it is interrupted, asserted in that
	 * order — because the second half alone would pass against a surface that never gated the wheel
	 * at all, which is a different program and not the one this case is about.
	 *
	 * A wheel rather than a key, because it is the shorter of the two doors `gestureInFlight()`
	 * shuts: `onWheel` returns on it directly, where the keyboard's arm is one layer down in
	 * `./keyDoors.ts`. This case says nothing about that one — the case below it does, and the two
	 * are kept apart because the doors are.
	 */
	it('lets the camera go again: the wheel zooms once the gesture has been abandoned', async () => {
		const rig = await selecting();
		const editor = useEditorStore(rig.pinia);
		const before = editor.viewport.zoom;

		held(rig, 'pointerdown', FROM, 1);
		held(rig, 'pointermove', SHORT, 1);
		await settle();
		wheel(rig);
		await settle();
		expect(editor.viewport.zoom).toBe(before);

		held(rig, 'pointercancel', SHORT, 0);
		await settle();
		wheel(rig);
		await settle();

		expect(editor.viewport.zoom).not.toBe(before);
		rig.unmount();
	});

	/**
	 * **The KEYBOARD's own arm of the same lock**, which the wheel case above deliberately does not
	 * cover and says so. `EditorSurface.onWheel` returns on `gestureInFlight()` directly; the
	 * keyboard's arm is one layer down, in `./keyDoors.ts`'s `onKeyDown`, and it is a different
	 * expression that a change could drop on its own.
	 *
	 * `+` rather than an arrow or a fit shortcut, out of the sites `grep -n 'surface.gestureInFlight()'
	 * src/presentation/editor/surface/keyDoors.ts` prints — two: the arrow-nudge dispatch, and the
	 * short-circuit chain `zoomShortcut` sits below. The chain is the one a user reaches on THIS
	 * surface with nothing else arranged: a nudge needs a selection and a wired `nudgeSelection`,
	 * where `+` needs only the canvas focused, and it is the exact keyboard counterpart of the wheel
	 * — same store, same reading, so the two cases differ in the door and in nothing else.
	 *
	 * Asserted refused-then-free in that order, for the wheel case's reason: the second half alone
	 * would pass against a surface that never gated the keyboard at all.
	 */
	it('lets the keyboard go again: the zoom key zooms once the gesture has been abandoned', async () => {
		const rig = await selecting();
		const editor = useEditorStore(rig.pinia);
		const before = editor.viewport.zoom;

		held(rig, 'pointerdown', FROM, 1);
		held(rig, 'pointermove', SHORT, 1);
		await settle();
		zoomKey(rig);
		await settle();
		expect(editor.viewport.zoom).toBe(before);

		held(rig, 'pointercancel', SHORT, 0);
		await settle();
		zoomKey(rig);
		await settle();

		expect(editor.viewport.zoom).not.toBe(before);
		rig.unmount();
	});
});

/**
 * **A release outside the leaf COMMITS, and is the one thing in this neighbourhood that is NOT an
 * interruption** — which is why it sits here, beside the three that are.
 * `DesignerSelectTool.dropMarquee`'s docblock carries the mechanism and the sentence it corrected:
 * `onPointerDown` calls `setPointerCapture` on both of its arms, so the release is delivered back
 * to the captured container and the sweep ends the way any other sweep ends.
 *
 * **jsdom implements no pointer capture at all**, measured rather than assumed —
 * `setPointerCapture` is `undefined` on an element there, which is exactly why `EditorSurface`
 * spells the call `?.()`. So the delivery itself cannot be observed here and this case does not
 * claim to observe it. What it drives is the SHAPE capture produces: a release dispatched at the
 * container while carrying coordinates outside the container's own bounding rect. What it checks is
 * the narrower claim that holds without capture — that the release door consults neither those
 * bounds nor the event's target, so a release out there composes the selection exactly as one
 * inside would.
 *
 * The outside-ness is ASSERTED rather than reasoned from the camera arithmetic in this file's
 * header: if `TO` ever lands inside the pane, this case must go red rather than quietly become a
 * case about an ordinary release.
 *
 * **This case CONTRADICTS a sibling, and the pointer belongs here because that sibling cannot
 * carry it.** `tests/presentation/designer/tools/designerSelectMarquee.test.ts` still says the
 * refuted thing twice — in the docblock above its `it.each` (*"`pointercancel` / focus loss / a
 * release outside the leaf, which `EditorSurface` all route to `abandonGesture`"*) and in that
 * table's own label, `'pointercancel, blur or a release outside the leaf'`. Both are verbatim the
 * sentence `dropMarquee`'s docblock was corrected for. Its CASES are sound — they call
 * `tool.abandonGesture()` directly and assert what an abandonment leaves, which is true of the two
 * inputs that really do reach it; it is the third item in each list that names a door
 * `EditorSurface` does not have. Named here rather than fixed there because that file is another
 * lease, and because ADR-0015's rule applies: a contradiction findable from only one side is one
 * the next reader resolves the wrong way.
 */
describe('a sweep released outside the leaf', () => {
	it('commits the selection rather than abandoning it', async () => {
		const rig = await selecting();
		const outside = rig.at(TO);
		const pane = rig.canvasEl.getBoundingClientRect();
		expect(outside.x).toBeLessThan(pane.left);
		expect(outside.y).toBeLessThan(pane.top);

		held(rig, 'pointerdown', FROM, 1);
		held(rig, 'pointermove', TO, 1);
		await settle();
		expect(band(rig)).toBeDefined();

		held(rig, 'pointerup', TO, 0);
		await settle();

		// The whole sweep, composed at a release the leaf never saw the pointer return for.
		expect(useAssetDesignStore(rig.pinia).selected).toEqual([
			{ kind: 'detail', id: 'detail-1' },
			{ kind: 'detail', id: 'detail-2' },
		]);
		expect(band(rig)).toBeUndefined();
		rig.unmount();
	});
});
