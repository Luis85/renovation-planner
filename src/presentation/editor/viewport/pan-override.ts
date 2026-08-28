/**
 * The pan OVERRIDE: a spring-loaded camera gesture that outranks whichever `EditorTool` is
 * active, and reaches `ToolManager` at no point at all.
 *
 * **Why it is not a `PanTool`,** which is what SDD §57 lists and what the obvious reading of
 * "another mode" would build. Switching tools runs the switch lifecycle — the outgoing
 * tool's `deactivate()` — so holding space halfway through a polygon would discard the
 * vertices already placed, and holding it mid-calibration would discard the first point.
 * That is the exact opposite of what the gesture is for: the user reaches for it BECAUSE
 * the thing they are drawing runs off the edge of the pane. Overriding above the manager
 * means the interrupted tool is not told anything happened, so there is nothing for it to
 * lose. `PlanCanvas.vue` is where that routing lives; this is the machine it asks.
 *
 * Everything here is a decision about STATE and none of it touches a DOM or a Vue ref,
 * which is why it is a module with node tests rather than a handful of refs inside the
 * component. The canvas contributes exactly the translation of DOM events into these calls.
 *
 * The two triggers are the two the research settled on (`docs/tests/cases/Canvas
 * Navigation.md` records it): **space held** — universal across Figma, Photoshop,
 * Illustrator, Excalidraw and Obsidian's own Canvas — and the **middle button**, which
 * Obsidian Canvas documents as its own pan gesture. The right button is deliberately NOT
 * one: it works in Obsidian Canvas on Windows and not on macOS because macOS fires
 * `contextmenu` on mousedown where Windows fires it on mouseup, and claiming it here would
 * mean suppressing the context menu on a canvas that may yet want one.
 */

/** Which button a pointer event carries, in the vocabulary `EditorPointerEvent` already uses. */
export type PanButton = 'primary' | 'auxiliary' | 'secondary';

/**
 * What the camera is doing, as the ONE value the cursor and the routing both read.
 *
 * `armed` is a real state and not an implementation detail: it is the moment the user has
 * asked for the camera and not yet moved it, and it is what the `grab` cursor promises.
 */
export type PanPhase = 'idle' | 'armed' | 'panning';

/** What the machine needs to know about the rest of the editor, asked at the one call that needs it. */
export interface PanOverrideContext {
	/** Whether the active tool is mid-gesture — see `pointerDown`. */
	readonly toolGestureInFlight: boolean;
}

export class PanOverride {
	/**
	 * Two independent facts rather than one `PanPhase` field, because they genuinely overlap:
	 * a middle-button drag can run while space is held, and space can be released while a
	 * space-started drag is still running. A single enum would have to encode the product of
	 * the two and would make "release space mid-drag" a transition rather than the
	 * non-event it is.
	 */
	private spaceHeld = false;
	private panningWith: PanButton | null = null;

	/** `panning` outranks `armed`: what the pointer is doing beats what the keyboard offers. */
	get phase(): PanPhase {
		if (this.panningWith !== null) return 'panning';
		return this.spaceHeld ? 'armed' : 'idle';
	}

	/**
	 * Space went down. Idempotent, because a held key autorepeats at the OS rate — the canvas
	 * filters `event.repeat`, but a machine that could be knocked out of `panning` by a
	 * second arm would be relying on that filter to stay correct.
	 */
	armSpace(): void {
		this.spaceHeld = true;
	}

	/**
	 * Space came up. A pan already running is deliberately NOT ended: the gesture belongs to
	 * the drag and the modifier only started it, so releasing space with the button still
	 * down leaves the pan alive until the pointer is released. Photoshop, Figma and Obsidian
	 * Canvas all behave this way, and the alternative strands the user's pointer halfway
	 * through a pan they are still making.
	 */
	disarmSpace(): void {
		this.spaceHeld = false;
	}

	/**
	 * Answers whether this press begins a pan — `true` meaning the canvas routes it to the
	 * camera and the active tool hears nothing about it.
	 *
	 * The `toolGestureInFlight` guard covers the middle button only in practice: the primary
	 * button cannot be pressed while a tool is already dragging with it. Starting a pan under
	 * a live tool gesture would move the world beneath a drag the tool still believes in, and
	 * the eventual release would commit at a position the user never chose.
	 */
	pointerDown(button: PanButton, context: PanOverrideContext): boolean {
		if (this.panningWith !== null) return false;
		if (context.toolGestureInFlight) return false;
		const claims = button === 'auxiliary' || (button === 'primary' && this.spaceHeld);
		if (!claims) return false;
		this.panningWith = button;
		return true;
	}

	/**
	 * Answers whether the release ended a pan, so a release the camera did not consume still
	 * reaches the active tool.
	 *
	 * Where it lands is whatever the keyboard still says: back to `armed` while space is
	 * held — so a second drag needs no second keypress — and to `idle` otherwise.
	 */
	pointerUp(): boolean {
		if (this.panningWith === null) return false;
		this.panningWith = null;
		return true;
	}

	/**
	 * Everything abandoned: `pointercancel` (the OS took the pointer, and no `pointerup` will
	 * ever arrive) and the canvas losing focus.
	 *
	 * Focus loss has to drop the HELD SPACE too, and that is the whole reason this clears
	 * both fields rather than only the drag. The canvas listens for keys on itself rather
	 * than on `document` — so that a plan editor in one split leaf cannot swallow the space
	 * bar of a note being edited in another — which means a user who alt-tabs away mid-hold
	 * releases the key somewhere this machine will never hear. Without this, the canvas comes
	 * back armed forever and the next click pans instead of selecting.
	 */
	cancel(): void {
		this.spaceHeld = false;
		this.panningWith = null;
	}
}
