import type { Ref } from 'vue';
import type { useEditorStore } from '../../stores/EditorStore';
import { screenPoint } from '../viewport/Viewport';
import type { PanOverride } from '../viewport/pan-override';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Vector } from '../../../core/geometry/Vector';
import type { ToolId } from '../tools/editor-tool';
import type { ToolManager } from '../tools/tool-manager';
import { routeEscape } from '../escapeRouting';
import { arrowVector, finishShortcut } from './keyboard';

/**
 * The KEYBOARD half of `EditorSurface.vue` — the two handlers its `@keydown`/`@keyup` bind and
 * the shortcuts they route to — lifted out unchanged when that file reached its 400-line
 * budget. The key SEMANTICS (`arrowVector`, `finishShortcut`) were already pure in
 * `./keyboard.ts`; what lives here is the routing, which reads the surface's own state and so
 * could not be pure. It takes that state as `KeyDoorSurface`, one member per thing a door
 * actually reads, rather than the component instance, so that a door wired to the wrong member
 * is a type error and a node of this interface is the whole of what a test has to fake.
 *
 * Every ordering the handlers carry — `preventDefault` above the gesture lock, Escape swallowed
 * during a pan, the arrow check above the lock, the ungated Shift release — is a recorded
 * decision (`docs/development/agent-guide-increment-history.md`), and each sits where it did in
 * the surface, comment and all.
 */

/**
 * The members `EditorSurface.vue`'s host answers through its props, read at call time.
 * Function-typed PROPERTIES rather than method signatures, as the props themselves are — a
 * method here would make `finishArea`'s pass-through read as an unbound `this`.
 */
export interface KeyDoorHost {
	readonly framedBounds: (all: boolean) => BoundingBox | null;
	readonly setTool: (id: ToolId | null) => void;
	readonly hasSelection: () => boolean;
	readonly clearSelection: () => void;
	readonly nudgeSelection: (by: Vector) => Promise<void>;
	readonly finishArea: () => void;
}

/** What the key doors read of the surface — never the surface itself. */
export interface KeyDoorSurface {
	readonly container: Ref<HTMLElement | null>;
	readonly size: Ref<{ width: number; height: number }>;
	readonly activeToolId: Ref<ToolId | null>;
	readonly editor: Pick<ReturnType<typeof useEditorStore>, 'dragState' | 'fitTo' | 'zoomByFactor'>;
	readonly toolManager: Pick<ToolManager, 'finishActiveTool' | 'editActiveCorner' | 'activeToolHasDraft' | 'cancelGesture'>;
	readonly panOverride: Pick<PanOverride, 'phase' | 'armSpace' | 'disarmSpace'>;
	readonly host: KeyDoorHost;
	syncPanPhase(): void;
	reissuePointerMove(source: KeyboardEvent): void;
	gestureInFlight(): boolean;
}

/** One `+`/`-` press. A ratio rather than an increment — exponential, like the wheel, so the feel is the same at every scale. */
const KEY_ZOOM_STEP = 1.2;

/** The canvas's key doors, closed over the surface they read. */
export function canvasKeyDoors(surface: KeyDoorSurface): { onKeyDown(event: KeyboardEvent): void; onKeyUp(event: KeyboardEvent): void } {
	const { activeToolId, editor, toolManager, panOverride, host } = surface;

	/** `finishShortcut`'s doors — the key semantics live in `./keyboard.ts`. */
	function finishKeys(event: KeyboardEvent): boolean {
		return finishShortcut(event, {
			tool: activeToolId.value,
			finishArea: host.finishArea,
			finishActiveTool: () => toolManager.finishActiveTool(),
			undoDraftPoint: () => toolManager.editActiveCorner(-1, null),
		});
	}

	/**
	 * `Shift+1` frames the whole plan and `Shift+2` frames the selection — Obsidian's own Canvas
	 * shortcuts, so a user who knows one already knows the other. Answers whether the key was
	 * one of them, so the zoom-step branch is not also consulted for it.
	 *
	 * Matched on `event.code` — the PHYSICAL key — rather than on `event.key`, which is the
	 * character the layout produces. Shift+2 gives `@` on a US keyboard, `"` on the German and
	 * UK ones; a `key`-based match made this shortcut silently dead for those users, and this
	 * plugin ships a German locale, so that is not an edge case here. It is also the worst
	 * failure a shortcut can have — nothing happens and nothing says why.
	 *
	 * The `shiftKey` test stays BESIDE the code test rather than instead of it: `code` alone
	 * would fire on a bare `1`, which a user presses for all sorts of reasons and which a future
	 * tool hotkey would plausibly want.
	 *
	 * A fit with nothing to frame does NOTHING, which is why `framedBounds` and `fitTo` each
	 * answer that way rather than defaulting: a jump to nowhere costs the user the view they
	 * had and tells them nothing about why.
	 */
	function fitShortcut(event: KeyboardEvent): boolean {
		if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.repeat) return false;
		const all = (!event.shiftKey && event.key.toLowerCase() === 'f') || (event.shiftKey && event.code === 'Digit1');
		const selected = event.shiftKey && event.code === 'Digit2';
		if (!all && !selected) return false;
		event.preventDefault();
		const bounds = host.framedBounds(all);
		if (bounds === null) return true;
		editor.fitTo(bounds, surface.size.value);
		// A fit moves the camera further than any other door here — the pointer can end up over a
		// completely different part of the plan — so the re-issue matters most at exactly this one.
		surface.reissuePointerMove(event);
		return true;
	}

	/**
	 * Whether a key event is the CANVAS's own, rather than one bubbling up from something
	 * focusable inside it.
	 *
	 * The empty states are overlays INSIDE this element (`EditorSurface.vue`'s
	 * `<slot name="overlay" />`), and `planEditor.noZones` carries an action button — so its
	 * `keydown` reaches this handler by bubbling. Every shortcut here calls `preventDefault()`,
	 * and on a `<button>` that suppresses the native Space activation: the canvas's only
	 * keyboard-reachable control stopped working under the standard gesture for pressing it,
	 * while the camera armed behind it.
	 *
	 * Tested against the container rather than by sniffing for interactive tag names: the rule is
	 * "these shortcuts belong to the canvas when the canvas is what has focus", which stays true
	 * for whatever the overlay slot holds next.
	 */
	function isCanvasKey(event: KeyboardEvent): boolean {
		return event.target === surface.container.value;
	}

	/**
	 * `+`/`-`, anchored at the middle of the stage since a keypress involves no pointer (§85 asks
	 * for the one interaction slice 5 added to be reachable by key).
	 *
	 * Split out of `onKeyDown` alongside `fitShortcut` when merging design slice 13's Shift
	 * branch into this branch's own took that handler past the complexity budget. The two
	 * shortcuts now read the same way, which is the better shape regardless of what forced it.
	 */
	function zoomShortcut(event: KeyboardEvent): void {
		const factor = event.key === '+' || event.key === '=' ? KEY_ZOOM_STEP : event.key === '-' ? 1 / KEY_ZOOM_STEP : null;
		if (factor === null) return;
		event.preventDefault();
		editor.zoomByFactor(screenPoint(surface.size.value.width / 2, surface.size.value.height / 2), factor);
		surface.reissuePointerMove(event);
	}

	/**
	 * §85 asks for keyboard-accessible controls, and every shortcut here answers that — zoom, both
	 * fit shortcuts, and `Escape` below.
	 *
	 * `Escape` is no longer a synonym for "abandon whatever gesture is running": see `routeEscape`
	 * (`../escapeRouting.ts`) for the whole precedence it now carries — a running pan swallows it, a
	 * tool holding a draft cancels the draft and stays active, an empty creation tool returns to
	 * Select, and Select (or camera mode) with a selection clears it. The Escape branch just below
	 * spells out why each rule holds, in the order it holds it.
	 */
	function handleCanvasEscape(event: KeyboardEvent): void {
		// This press belongs to the canvas; the root must not route it a second time.
		event.stopPropagation();
		event.preventDefault();
		// **The fourth door to take the rule the three pointer handlers already carry**: while
		// a pan is RUNNING the canvas belongs to the camera, and every other input is swallowed
		// rather than handed to the active tool. Escape was the one input still routed straight
		// past it, and it was the destructive one — `cancelGesture()` empties
		// `DrawPolygonTool`'s vertex buffer, so a user mid-polygon who held space to pan and hit
		// Escape lost the whole polygon while the pan carried on underneath. Measured: no zone
		// could be closed afterwards at all. Exactly the defect `pointercancel` was corrected
		// for, in the one door nobody re-read the argument against.
		//
		// SWALLOWED rather than routed to the pan, which is what the finding suggested. Ending
		// the pan here would leave the user's button still down with the override no longer
		// owning it, so the eventual release would reach the active tool as a release with no
		// matching press — the event-grammar defect this file has already recorded three times.
		// And it would buy nothing: a pan has no uncommitted state for Escape to undo, since
		// the camera does not rewind. The user releases the button and presses Escape, which is
		// the gesture they would make anyway.
		//
		// `panning`, never `armed`: space merely HELD is not a gesture, so Escape still reaches
		// the tool then — which is the case the camera lock deliberately carved this branch out
		// for and must keep working.
		//
		// **`event.repeat` because ONE PRESS IS ONE PRESS.** A phase test alone reads each
		// autorepeat as a fresh decision, so a user holding Escape as the pan ended had the
		// keydown swallowed and then the OS's next repeat of that same press — arriving a few
		// tens of milliseconds later, with the phase no longer `panning` — reach
		// `cancelGesture()` and clear the polygon anyway. Whether the buffer survived came down
		// to whether the button was released before the next repeat, which is a race and not a
		// rule.
		//
		// Filtering every repeat rather than tracking THIS press through its keyup, which is
		// the same thing with no state to keep: a repeat is never new intent, and `cancel()` is
		// idempotent, so the two differ only for repeats of a press that already cancelled —
		// where the second call clears an empty buffer. Escape means cancel once. The space
		// branch above filters repeats for its own reasons and this is the same sentence.
		//
		// **What Escape does once it is not a repeat is `routeEscape`'s question now, not a
		// single unconditional `cancelGesture()`.** A pan still swallows it first, exactly for
		// the reasons the paragraphs above give — `panning: panOverride.phase === 'panning'` is
		// that same guard, carried into the call as data rather than kept as a condition on it.
		// (`phase` read off the override directly rather than off the surface's mirrored ref: the
		// mirror is re-synced after every mutation, in the same tick, so the two never disagree at
		// a handler, and the mirror exists for the template's reactivity rather than for a door.)
		// Past that: a tool holding a draft — `hasDraft()` — is cancelled and stays active
		// exactly as before; a creation tool with NOTHING drawn returns to Select instead of
		// leaving Escape a no-op over an empty buffer; and Select itself, or camera mode with no
		// tool at all, clears a selection when there is nothing left to cancel.
		if (!event.repeat) {
			routeEscape({
				panning: panOverride.phase === 'panning' || (activeToolId.value === 'pan' && editor.dragState !== null),
				activeToolId: activeToolId.value,
				hasDraft: () => toolManager.activeToolHasDraft(),
				cancelGesture: () => toolManager.cancelGesture(),
				setTool: (id) => host.setTool(id),
				hasSelection: host.hasSelection(),
				clearSelection: () => host.clearSelection(),
			});
		}
	}

	function onKeyDown(event: KeyboardEvent): void {
		if (!isCanvasKey(event)) return;
		if (event.key === 'Escape') { handleCanvasEscape(event); return; }
		if (event.key === ' ') {
			// `preventDefault` comes FIRST, above the gesture lock, and that ordering is the whole
			// point: space is page-down in a scrollable leaf, a held key autorepeats at the OS rate,
			// and the gesture is DEFINED by holding it. Suppressing only the first keydown let every
			// repeat through for the length of the pan, scrolling the editor leaf out from under the
			// plan — which is what putting the lock above this branch quietly did.
			event.preventDefault();
			// **`spaceHeld` is a record of the PHYSICAL key, so nothing conditional may skip it.**
			// The camera lock used to sit here too, and that made the record disagree with the
			// hand: a space pressed DURING a tool drag or a middle-button pan was dropped, and no
			// second non-repeat keydown is ever coming for a key that is already down — so the user
			// released the other gesture still holding space over a machine that thought it was up,
			// and their next primary drag went to the tool instead of the camera.
			//
			// The refusal belongs at `PanOverride.pointerDown`, which is the one place a gesture is
			// actually CLAIMED, and it already refuses there — the same "one function nothing can
			// restate" the surface reached for `gestureInFlight` itself. Arming moves no camera; it
			// only says what the keyboard is doing.
			//
			// `armSpace` is idempotent, so the repeat filter is belt and braces — it is here to
			// spare `syncPanPhase` an OS-rate call, not to hold the state together.
			if (event.repeat) return;
			panOverride.armSpace();
			surface.syncPanPhase();
			return;
		}
		// Shift is the angle constraint, and it has to bite the moment it goes down rather than
		// on the next pointer move: a user holds it to make the line they are ALREADY drawing
		// straight, and a preview that only answers once the hand twitches reads as a dead key.
		// The same re-issue serves its release, where the constraint has to let go just as
		// promptly. `event.shiftKey` is true on the press and false on the release, so the tool
		// reads the state rather than the transition — which is also what makes this work under
		// Sticky Keys, where the modifier latches and no key is physically held at all.
		//
		// ABOVE the camera lock, and deliberately, for the same reason Escape is: it moves no
		// camera, and a user holds Shift precisely while a gesture is in flight — gating it there
		// would make the constraint dead exactly when it is wanted.
		//
		// Alt is the overlap-cycling modifier and takes the identical re-issue, for the identical
		// reason: `SelectTool.targetAt` reads `modifiers.alt` for the hover AND the click, so a
		// press over a stationary pointer left the hover predicting the topmost room while the
		// click that followed cycled to the next one. Reported by a review bot on the
		// multi-selection pull request.
		if (event.key === 'Shift' || event.key === 'Alt') {
			surface.reissuePointerMove(event);
			return;
		}
		// Escape is handled ABOVE this, and deliberately: `routeEscape`'s question — cancel a
		// draft, switch tool, or clear a selection — must be answered whether or not a gesture is
		// in flight, and none of its outcomes touches the camera.
		//
		// **This arrow check is ABOVE the gesture lock now, and on purpose (Finding B, the
		// whole-tree review).** `gestureInFlight()` used to return FIRST, so an arrow key pressed
		// mid-drag or mid-draw fell through this whole function uncaught: `preventDefault()` never
		// ran, and the leaf underneath the still-running gesture scrolled out from under it — the
		// same shape Space's own branch above already avoids for the identical reason. Consuming
		// the key is not the same decision as acting on it, so `preventDefault()` stays
		// unconditional inside the `nudge !== null` branch while the DISPATCH keeps asking
		// `gestureInFlight()` itself: a nudge mid-gesture would move the very selection the
		// gesture is already moving, which is what the guard below still refuses.
		// §85's one operation slice 5 left unreachable by keyboard (E8, Task 14): an arrow key
		// nudges whatever `nudgeSelection` finds selected. `arrowVector` answers `null` for every
		// other key, so this is a lookup rather than four more `if`s beside the ones above.
		// `!event.repeat`: OS autorepeat re-reads the same pre-move zone every tick (the store
		// only refreshes after the queued hydrate), so a held key would dispatch — and undo — the
		// same move dozens of times instead of once.
		const nudge = arrowVector(event);
		if (nudge !== null) {
			event.preventDefault();
			if (!event.repeat && !surface.gestureInFlight()) void host.nudgeSelection(nudge);
			return;
		}
		// One short-circuit chain, in this order: a running gesture swallows every key below it.
		if (surface.gestureInFlight() || finishKeys(event) || fitShortcut(event)) return;
		zoomShortcut(event);
	}

	/**
	 * The two keys whose RELEASE means something here, and nothing else: a handler that acted on
	 * every keyup would fire once per keystroke of whatever the user typed with the canvas
	 * focused. Every other key either does its work on the press (Escape, the zoom pair) or means
	 * nothing to this element at all.
	 *
	 * Shift is the angle constraint letting go, and it re-issues the move so the preview
	 * unconstrains as promptly as it constrained; Alt is overlap cycling letting go, re-issued so
	 * the hover stops cycling the moment the click would. Space is the pan disarming — and a pan already
	 * RUNNING is deliberately not ended by it, for the reason `PanOverride.disarmSpace` gives.
	 *
	 * **Not a symmetric pair with the press, and deliberately not one.** `onKeyDown`'s Shift
	 * branch is gated behind that handler's own `isCanvasKey` check, same as every other canvas
	 * key — a press only constrains while the canvas itself has focus. The RELEASE here is
	 * UNGATED: `isCanvasKey` guards the space branch alone, because Shift is a MODIFIER rather
	 * than a canvas shortcut, and it reaches this element while the empty state's action button
	 * has focus too. A Shift pressed on the canvas and released after Tab moved focus to that
	 * button must still unconstrain the preview — the drag it was steering does not know focus
	 * moved — so gating the release the same way the press is gated would strand the constraint
	 * on. A space release there, by contrast, belongs to the button it lands on, not the camera.
	 */
	function onKeyUp(event: KeyboardEvent): void {
		if (event.key === 'Shift' || event.key === 'Alt') {
			surface.reissuePointerMove(event);
			return;
		}
		if (!isCanvasKey(event) || event.key !== ' ') return;
		panOverride.disarmSpace();
		surface.syncPanPhase();
	}

	return { onKeyDown, onKeyUp };
}
