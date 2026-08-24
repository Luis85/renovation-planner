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
 * 2. **`cancelGesture()` with no gesture in flight is a no-op**, not a defensive call to
 *    the active tool's `cancel()`. This is the same rule the tool-switch lifecycle already
 *    states — "the outgoing tool's `cancel()`, **only if** a gesture is in flight" — so
 *    `cancelGesture()` and the switch path share one rule instead of two: a tool's
 *    `cancel()` is called exactly when there is a gesture for it to discard, never as a
 *    speculative "just in case." An `Escape` handler can therefore call it unconditionally
 *    without checking gesture state itself.
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
	private gestureInFlight = false;

	constructor(private readonly contextFactory: () => EditorContext) {}

	get activeToolId(): ToolId | null {
		return this.activeTool?.id ?? null;
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
			if (this.gestureInFlight) {
				outgoing.cancel();
				this.gestureInFlight = false;
			}
			outgoing.deactivate();
		}
		this.activeTool = next;
		next.activate(this.contextFactory());
	}

	/** A no-op when no tool is active (decision 1 above). */
	pointerDown(event: EditorPointerEvent): void {
		if (!this.activeTool) {
			return;
		}
		this.gestureInFlight = true;
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
		this.gestureInFlight = false;
	}

	/**
	 * Abandons the in-progress gesture, typically on `Escape`: calls the active tool's
	 * `cancel()` and clears the in-flight flag. A no-op — `cancel()` is never called — when
	 * there is no gesture in flight, or no active tool (decision 2 above).
	 */
	cancelGesture(): void {
		if (!this.gestureInFlight || !this.activeTool) {
			return;
		}
		this.activeTool.cancel();
		this.gestureInFlight = false;
	}
}
