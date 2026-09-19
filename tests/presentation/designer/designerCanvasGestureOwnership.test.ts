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
 * **The last case is about what the interruption UNLOCKS rather than what it tidies away**, and it
 * is the one that asks whether the event was heard at all. `cancelInterruptedGesture()` is what
 * clears `ToolManager`'s `#gestureInFlight`, and `EditorSurface` returns early on
 * `gestureInFlight()` at its wheel door and again in `./keyDoors.ts` — so a sweep whose
 * interruption is never heard leaves the camera and the keyboard refused for the rest of the
 * session, with the band already gone and nothing on screen to say why. The three cases above all
 * read state the TOOL cleared; this one reads a door the MANAGER reopened.
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
import type Konva from 'konva';
import { t } from '../../../src/presentation/i18n/strings';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { editableShape } from '../../helpers/assetShapes';
import { designerRig, drag, type DesignerRig } from '../../helpers/designerRig';
import { settle } from '../../helpers/editor';

/** Its clearance reaches x 700 by y 700, so (1000, 1000) is empty canvas and (-1000, -1000) is too. */
const SHAPE = editableShape();
const FROM = { x: 1000, y: 1000 };
const TO = { x: -1000, y: -1000 };
/**
 * Ten screen pixels from `FROM` at the rig's camera — past the four-pixel threshold that makes a
 * press a sweep, and nowhere near the pane's edge, so no edge-scroll moves the camera under the
 * rectangle while the assertion is being made.
 */
const SHORT = { x: 900, y: 900 };

const band = (rig: DesignerRig): Konva.Node | undefined => rig.stage.findOne('.selection-marquee');

/** The designer with Select reached the way a user reaches it: by pressing its toolbar button. */
async function selecting(): Promise<DesignerRig> {
	const rig = await designerRig({ shape: SHAPE });
	rig.toolbarButton(t('en', 'designer.toolbar.select')).click();
	await settle();
	return rig;
}

/** One pointer event with `buttons` as a device sets it, for the cases that assert BETWEEN a move and its release. */
function held(rig: DesignerRig, type: string, world: { x: number; y: number }, buttons: number): void {
	const at = rig.at(world);
	rig.canvasEl.dispatchEvent(
		new PointerEvent(type, { button: 0, buttons, pointerId: 1, clientX: at.x, clientY: at.y, bubbles: true }),
	);
}

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
	 * `./keyDoors.ts`. Either would do; nothing here claims the key door is covered by this.
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
});
