import type { Point } from '../../../core/geometry/Point';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import type { RoomDraftPort, RoomRect, RoomRectSnapshot } from '../add/room-draft-store';
import type { EditorContext } from './editor-context';
import type { EditorPointerEvent, EditorTool, ToolId } from './editor-tool';

export interface DrawRoomToolDeps {
	readonly draft: RoomDraftPort;
	readonly defaultName: () => string;
}

function normalised(a: Point, b: Point): RoomRect {
	return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), depth: Math.abs(b.y - a.y) };
}

/**
 * The rectangular room tool (design spec §4): a primary drag writes one axis-aligned rectangle
 * into the draft store; a click changes nothing; Escape discards the draft and stays; a tool
 * switch resets the draft. It touches no `RenderState`, dispatches nothing and names no Zone —
 * the draft store is the one home for what it draws (spec §2.2), and `createRoomFromDraft` is
 * what turns that into a command.
 */
export class DrawRoomTool implements EditorTool {
	readonly id: ToolId = 'draw-room';
	private context: EditorContext | null = null;
	private anchor: Point | null = null;
	/**
	 * What this gesture has overwritten, or `null` while it has overwritten nothing.
	 *
	 * **Taken at the first `pointerMove`, immediately before the overwrite — NOT at
	 * `pointerdown`** — which is what makes "a click takes back exactly what this press
	 * overwrote" literally true rather than approximately true. A press does not itself write
	 * anything; `pointerMove` does. Snapshotting at the press instead captures a moment that
	 * can still be overtaken by a write nobody here made, and one such write is ordinary:
	 *
	 * A renovator types `4.2` into Width and clicks the canvas. `NewRoomInspector` keeps that
	 * text in the DOM until a `blur`, and a browser moves focus as `pointerdown`'s own DEFAULT
	 * ACTION, which runs AFTER this handler returns — the ordering `DialogHost` already records
	 * paying for. So the order really is: press (snapshot taken), blur (the field commits
	 * `4.2`), release. A snapshot from the press predates that commit, so the click branch put
	 * the store back to before it and the typed width vanished with no gesture having replaced
	 * it. Note the canvas calls no `preventDefault` on an ordinary primary press, so nothing
	 * suppresses that focus shift.
	 *
	 * Deferring the capture fixes the CLASS rather than the blur: any write between the press
	 * and the first move is simply part of the state this gesture then overwrites, whoever made
	 * it. And a click with NO move — which is a legal stream, since W3C guarantees no move
	 * between a down and an up — now has nothing to take back, because nothing was taken.
	 *
	 * Nullable for that reason, where the earlier field was a definite assignment: the empty
	 * arm is reachable by exactly that click, and is the case this whole comment is about.
	 */
	private pressUndo: RoomRectSnapshot | null = null;

	constructor(private readonly deps: DrawRoomToolDeps) {}

	activate(context: EditorContext): void {
		this.context = context;
		this.deps.draft.beginTask(this.deps.defaultName());
	}
	deactivate(): void {
		this.anchor = null;
		this.deps.draft.reset();
		this.context = null;
	}
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary') return;
		this.anchor = event.worldPoint;
		this.pressUndo = null;
	}
	pointerMove(event: EditorPointerEvent): void {
		if (this.anchor === null) return;
		// Captured on the FIRST move only, and before the write it is about — see `pressUndo`.
		this.pressUndo ??= this.deps.draft.snapshotRect();
		this.deps.draft.setRect(normalised(this.anchor, event.worldPoint));
	}
	/**
	 * `context` is fetched into a local and checked ALONGSIDE `this.anchor` in one guard,
	 * rather than read through `this.context?.… ?? 1` — the two class fields are set and
	 * cleared together (`activate`/`deactivate`), and `this.anchor` is null whenever
	 * `this.context` is, so a fallback for "no context" is an arm nothing can drive: every
	 * test that reaches this line does so through `activate()` first, per the tool lifecycle
	 * contract `EditorTool`'s own docblock states. Guarding both together is what lets the
	 * rest of the method read `context.viewport` unconditionally, matching `SelectTool`'s
	 * `pointerUp`.
	 */
	pointerUp(event: EditorPointerEvent): void {
		const context = this.context;
		if (context === null || this.anchor === null || event.button !== 'primary') return;
		const anchor = this.anchor;
		this.anchor = null;
		const worldPerPixel = context.viewport.worldPerScreenPixel();
		const moved = Math.hypot(event.worldPoint.x - anchor.x, event.worldPoint.y - anchor.y);
		if (moved <= CLICK_EPSILON_PX * worldPerPixel) {
			// A click takes back exactly what this gesture overwrote and nothing else — never a
			// typed side, its text, or a refusal the renovator has not corrected yet, and never
			// a commit that landed between the press and the release. `restore` is a no-op when
			// the gesture wrote nothing, which is the plain click with no move at all.
			this.restore();
			return;
		}
		// The RELEASE names the rectangle, not the last `pointermove` — `SelectTool`'s own rule
		// ("computes the commit from the release's world coordinate"), which this tool owes for
		// the same reason: W3C Pointer Events guarantees no move between a down and an up, so a
		// fast flick is a legal stream with none and settling the last move settles either a
		// null rect or a stale one. `moved` above is already measured against this same point,
		// so writing it here is what makes the gesture that was judged a drag the gesture that
		// gets committed.
		this.deps.draft.setRect(normalised(anchor, event.worldPoint));
		this.deps.draft.settle();
	}
	/**
	 * The DELIBERATE half of the pair (`EditorTool`'s own docblock): Escape or a tool switch,
	 * where the renovator wants the accumulation gone. It clears the rectangle, both typed
	 * sides and their texts and both refusals, and KEEPS the name and `keepAdding` — design
	 * spec §3's own list, and the other end of `hasDraft()`'s invariant: this clears exactly
	 * what that counts. Clearing less leaves Escape INERT (`routeEscape` would answer
	 * `cancelled-draft` for ever and never reach its return-to-Select arm); clearing MORE —
	 * the name, say — would take a choice the renovator made for a gesture aimed at the
	 * rectangle. `holdsInput` in `room-draft-store.ts` argues both directions once, for both
	 * ends.
	 */
	cancel(): void {
		this.anchor = null;
		this.deps.draft.clearRect();
	}
	/**
	 * The narrower of the pair: a press with no matching release restores exactly what that
	 * release would have discarded — what the press itself overwrote — rather than the whole
	 * draft `cancel()` throws away.
	 */
	abandonGesture(): void {
		if (this.anchor === null) return;
		this.anchor = null;
		this.restore();
	}

	/**
	 * Undo whatever this gesture overwrote, if it overwrote anything. One function for the two
	 * doors that owe it, so the "only if a snapshot was taken" half cannot be kept at one and
	 * forgotten at the other.
	 */
	private restore(): void {
		if (this.pressUndo === null) return;
		this.deps.draft.restoreRect(this.pressUndo);
		this.pressUndo = null;
	}
	/**
	 * Escape's question (`routeEscape`), and it is about every DIMENSION surface a room is
	 * built from rather than the rectangle alone — a typed width with no depth yet leaves
	 * `rect` null and is still a draft. `holdsInput` in `room-draft-store.ts` states what
	 * counts, what does not, and why it must be exactly what `cancel()` above clears.
	 */
	hasDraft(): boolean {
		return this.deps.draft.hasInput;
	}
}
