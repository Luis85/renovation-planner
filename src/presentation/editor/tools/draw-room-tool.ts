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
	 * What the press is about to overwrite, taken at `pointerdown` — a definite assignment
	 * rather than a nullable field, for the reason `pointerUp`'s own docblock gives about
	 * `context`: it is written beside `anchor` and read only where `anchor !== null`, so a
	 * null branch here would be an arm nothing can drive.
	 *
	 * It used to be a `RoomRect | null`, which is not enough to give a press back: `rect` is
	 * null for a draft holding a typed width and no depth, so a click restored it by CLEARING
	 * both sides, both texts and both errors. See `RectFields`.
	 */
	private pressUndo!: RoomRectSnapshot;

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
		this.pressUndo = this.deps.draft.snapshotRect();
	}
	pointerMove(event: EditorPointerEvent): void {
		if (this.anchor === null) return;
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
			// The move above wrote a tiny rect during the press; a click takes back exactly what
			// that press overwrote and nothing else — never a typed side, its text, or a refusal
			// the renovator has not corrected yet.
			this.deps.draft.restoreRect(this.pressUndo);
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
		this.deps.draft.restoreRect(this.pressUndo);
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
