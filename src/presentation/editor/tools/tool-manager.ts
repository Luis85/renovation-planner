import type { EditorContext } from './editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from './editor-tool';

/**
 * Owns which single `EditorTool` is active in a Plan Editor and the switch between them
 * (SDD §56, design slice 6, DoD 1/12). This class is deliberately framework only: it
 * knows nothing about `select`, `pan`, `draw-polygon` or any other concrete tool beyond
 * the `ToolId` it was registered under. Adding a future tool (`WallTool`, say) is a new
 * `EditorTool` implementation plus one `register()` call — never a change in here. There
 * is no `if (tool.id === '...')` anywhere in this file, and there must never be one (DoD
 * 12): that branch is exactly the shape a tool-specific special case would take.
 *
 * The context handed to `activate()` comes from a **factory callback**, not a value
 * captured once at construction, so every activation gets a live `EditorContext` — the
 * current viewport, selection and write ledger — rather than a stale snapshot from
 * whenever the manager itself was built.
 *
 * Three things this class decides that the task-7 spec leaves open, and why:
 *
 * 1. **A pointer method with no active tool is a no-op, not a throw.** Pointer input
 *    arrives from Konva's stage continuously and is not itself a programming error — a
 *    plugin can construct a `ToolManager`, register tools, and have a moment (or a bug
 *    upstream) where nothing is active yet. Throwing here would turn an ordinary "nothing
 *    to do" into a crash on every stray event; the manager instead does nothing and lets
 *    the caller decide whether that silence is worth noticing.
 * 2. **`cancelGesture()` with no ACTIVE TOOL is a no-op** — but it no longer requires a
 *    gesture in flight (restated in design slice 8; see the method's comment). The
 *    tool-SWITCH path keeps the original rule — "the outgoing tool's `cancel()`, **only
 *    if** a gesture is in flight" — so the switch calls `cancel()` exactly when the
 *    outgoing tool's gesture was interrupted, never as a speculative "just in case."
 *    (`cancelGesture()` — Escape — deliberately does NOT share that guard any more: a
 *    multi-click tool sits BETWEEN clicks with no drag in flight, and Escape must reach
 *    it there.)
 * 3. **Registering a second tool under an already-taken `ToolId` throws.** It is the same
 *    category of error as an unregistered id at `setActiveTool` — a wiring mistake at the
 *    composition root (e.g. two tools constructed with the same id, or a duplicate
 *    `register()` call) — not a state a running editor should silently paper over by
 *    picking a "last one wins" tool nobody asked for.
 *
 * Gesture tracking is a single boolean: `pointerDown` sets it, `pointerUp` and
 * `cancelGesture()` clear it. `setActiveTool` only ever calls the OUTGOING tool's
 * `cancel()`, and only when that flag is set — never the incoming tool's.
 */
export class ToolManager {
	private readonly tools = new Map<ToolId, EditorTool>();
	private activeTool: EditorTool | null = null;
	#gestureInFlight = false;

	constructor(private readonly contextFactory: () => EditorContext) {}

	get activeToolId(): ToolId | null {
		return this.activeTool?.id ?? null;
	}

	/**
	 * Whether a tool is between a press and its release — read by the pan override, which
	 * refuses to claim the middle button while one is running (a camera moving beneath a live
	 * drag would commit that drag at a position the user never chose).
	 *
	 * A GETTER over the flag this class already keeps, rather than a second boolean tracked
	 * by the canvas: two values modelling one gesture is the drift `activeToolId` itself had
	 * to be collapsed out of, and the copy would be the one that goes stale. The field behind
	 * it is `#private` rather than `private` so that this getter is genuinely the only way in
	 * — TypeScript's `private` is erased at runtime, and `tests/` is transpiled without type
	 * checking, so a test reaching for the field directly would pass while proving nothing.
	 */
	get gestureInFlight(): boolean {
		return this.#gestureInFlight;
	}

	/** Throws if `tool.id` is already registered (see decision 3 above). */
	register(tool: EditorTool): void {
		if (this.tools.has(tool.id)) {
			throw new Error(`ToolManager: a tool is already registered for id '${tool.id}'.`);
		}
		this.tools.set(tool.id, tool);
	}

	/**
	 * Switches the active tool. Setting the already-active id is a no-op: no `cancel()`,
	 * no `deactivate()`, no re-`activate()`. Otherwise, in order: the outgoing tool's
	 * `cancel()` (only if a gesture is in flight), then its `deactivate()`, then the
	 * incoming tool's `activate(context)` with a fresh context from the factory. Throws
	 * for an id nothing registered (a programming error, not an expected failure).
	 */
	setActiveTool(id: ToolId): void {
		const next = this.tools.get(id);
		if (!next) {
			throw new Error(`ToolManager: no tool is registered for id '${id}'.`);
		}
		if (this.activeTool?.id === id) {
			return;
		}
		const outgoing = this.activeTool;
		if (outgoing) {
			this.cancelInterruptedGesture();
			outgoing.deactivate();
		}
		this.activeTool = next;
		next.activate(this.contextFactory());
	}

	/**
	 * Returns to no active tool — design slice 8's camera mode, where the Plan Canvas
	 * pans on drag exactly as slice 5 shipped it. The same switch lifecycle as
	 * `setActiveTool`: the outgoing tool's `cancel()` only if a gesture is in flight,
	 * then its `deactivate()`. A no-op when nothing is active.
	 */
	clearActiveTool(): void {
		const outgoing = this.activeTool;
		if (!outgoing) return;
		this.cancelInterruptedGesture();
		outgoing.deactivate();
		this.activeTool = null;
	}

	/** A no-op when no tool is active (decision 1 above). */
	pointerDown(event: EditorPointerEvent): void {
		if (!this.activeTool) {
			return;
		}
		this.#gestureInFlight = true;
		this.activeTool.pointerDown(event);
	}

	/** A no-op when no tool is active (decision 1 above). */
	pointerMove(event: EditorPointerEvent): void {
		if (!this.activeTool) {
			return;
		}
		this.activeTool.pointerMove(event);
	}

	/** A no-op when no tool is active (decision 1 above). */
	pointerUp(event: EditorPointerEvent): void {
		if (!this.activeTool) {
			return;
		}
		this.activeTool.pointerUp(event);
		this.#gestureInFlight = false;
	}

	/**
	 * Abandons whatever the active tool holds, typically on `Escape`: calls its `cancel()`
	 * and clears the in-flight flag. A no-op only when NO tool is active.
	 *
	 * **Decision 2, restated by design slice 8's review pass.** This used to be a no-op
	 * unless `gestureInFlight` — but that flag models a DRAG: down sets it, up clears it,
	 * and a real mouse always delivers both. A multi-click tool (the polygon tool's
	 * buffer, the calibration tool's pending first point) sits BETWEEN clicks with the
	 * flag false, so the old guard made Escape do nothing exactly when the user needed it
	 * — while every test passed, because simulated event streams happily sent
	 * `pointerdown` without ever sending `pointerup`. Every `EditorTool.cancel()` is
	 * required to be safe when nothing is in flight (they all clear transient state and
	 * dispatch nothing), so the honest contract is: Escape always reaches the active
	 * tool. The tool-SWITCH path below keeps its in-flight guard — there the question is
	 * whether the OUTGOING tool's gesture was interrupted, and a completed click is not
	 * an interruption.
	 */
	cancelGesture(): void {
		if (!this.activeTool) {
			return;
		}
		this.activeTool.cancel();
		this.#gestureInFlight = false;
	}

	/**
	 * Abandons an INTERRUPTED gesture — a press whose release is never coming, because focus
	 * left the element or the tool was switched out from under it. A no-op when nothing is in
	 * flight, and that guard is the entire difference from `cancelGesture` above.
	 *
	 * **It is one question asked at three doors, and it was written out longhand at two of
	 * them before this existed** (both switch paths above, which call it now). The third is
	 * `PlanCanvas`'s `onBlur`, which asked it at NONE: an Alt+Tab mid-drag delivers no
	 * `pointerup` at all — the user releases the button in another application — so the
	 * gesture outlived the hand. `gestureInFlight` then refused every wheel and both fit
	 * shortcuts through `cameraIsLocked()` for the rest of the session, and `SelectTool` kept
	 * a translated preview whose delta the user's next click anywhere committed.
	 *
	 * A press-to-RELEASE gesture is the whole of what it abandons, which is why `Escape` may
	 * not be routed through it: a multi-click tool — the polygon tool's vertex buffer, the
	 * calibration tool's pending first point — sits BETWEEN clicks with the flag false, and
	 * a completed click is not an interruption. Escape is deliberate and always reaches the
	 * tool; a window losing focus says nothing about a buffer the user is still filling.
	 */
	cancelInterruptedGesture(): void {
		if (!this.#gestureInFlight) return;
		this.cancelGesture();
	}
}
