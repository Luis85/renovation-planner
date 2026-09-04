import type { Point } from '../../../core/geometry/Point';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import type { RoomDraftPort, RoomRect } from '../add/room-draft-store';
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
 * into the draft store; a click changes nothing; Escape clears the rectangle and stays; a tool
 * switch resets the draft. It touches no `RenderState`, dispatches nothing and names no Zone —
 * the draft store is the one home for what it draws (spec §2.2), and `createRoomFromDraft` is
 * what turns that into a command.
 */
export class DrawRoomTool implements EditorTool {
	readonly id: ToolId = 'draw-room';
	private context: EditorContext | null = null;
	private anchor: Point | null = null;
	private rectBefore: RoomRect | null = null;

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
		this.rectBefore = this.deps.draft.rect;
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
			// The move above wrote a tiny rect during the press; a click takes it back rather
			// than committing it — `clearRect()` when there was none, `setRect(rectBefore)`
			// when a rectangle already existed before this press began.
			if (this.rectBefore === null) this.deps.draft.clearRect();
			else this.deps.draft.setRect(this.rectBefore);
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
	cancel(): void {
		this.anchor = null;
		this.deps.draft.clearRect();
	}
	/**
	 * The narrower of the pair (`EditorTool`'s own docblock): a press with no matching release
	 * restores exactly what that release would have discarded — the pre-press rectangle, or
	 * nothing when there was none — rather than the whole draft `cancel()` throws away.
	 */
	abandonGesture(): void {
		if (this.anchor === null) return;
		this.anchor = null;
		if (this.rectBefore === null) this.deps.draft.clearRect();
		else this.deps.draft.setRect(this.rectBefore);
	}
	hasDraft(): boolean {
		return this.deps.draft.rect !== null;
	}
}
