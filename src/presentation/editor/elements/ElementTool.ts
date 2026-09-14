import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent, EditorTool } from '../tools/editor-tool';
import type { ElementDraft, ElementToolId } from './elementDraft';
import { discardElementGeometry, ELEMENT_TOOLS, pointsAfterUndo, shapedKind } from './elementDraft';
import type { Point } from '../../../core/geometry/Point';
import { SNAP_TOLERANCE_PX } from '../handleMetrics';
import { constrainDrawingPoint } from '../snapping/constrainDrawingPoint';
import { rectangleCorners } from './objectShape';

/**
 * Multi-click linear drafts share the standard tool lifecycle and require explicit Finish. An item or a
 * hatched area in rectangle mode is the one drag (2026-09-13 item modes spec §A): the press anchors a corner, every move
 * rewrites the four corners, and the release names the rectangle — `DrawRoomTool`'s rule, since a fast
 * flick is a legal pointer stream with no move at all. A click encloses no area and changes nothing.
 */
export class ElementTool implements EditorTool {
	private context: EditorContext | null = null;
	private dragAnchor: Point | null = null;
	constructor(readonly id: ElementToolId, private readonly deps: {
		draft: ElementDraft; start(id: ElementToolId): void; stop(): void; blocked(): boolean;
		addPoint(point: Point): boolean; setPoints(points: readonly Point[]): boolean; finish(): void;
	}) {}
	activate(context: EditorContext): void { this.context = context; this.deps.start(this.id); }
	deactivate(): void { if (this.context) this.context.renderState.snapGuides = []; this.context = null; this.dragAnchor = null; this.deps.stop(); }
	private inputContext(): EditorContext | null { return this.context && !this.deps.blocked() ? this.context : null; }
	private shaped(): boolean { return shapedKind(ELEMENT_TOOLS[this.id]); }
	pointerDown(event: EditorPointerEvent): void {
		if (event.button !== 'primary' || !this.inputContext()) return;
		this.pointerMove(event);
		// `blocked()` is read again inside the move above, so a press that turns blocked between
		// the two reads leaves `draft.cursor` unset — nothing to anchor or add.
		const cursor = this.deps.draft.cursor;
		if (!cursor) return;
		if (this.shaped() && this.deps.draft.shape === 'rectangle') this.dragAnchor = cursor;
		else this.deps.addPoint(cursor);
	}
	pointerMove(event: EditorPointerEvent): void {
		const context = this.inputContext();
		if (!context) return;
		// Shift squares a corner-by-corner segment; a drag is already axis-aligned, and an item never constrained.
		const square = event.modifiers.shift && this.id !== 'place-object' && !this.dragAnchor;
		const constrained = constrainDrawingPoint(this.deps.draft.points.at(-1), event.worldPoint, square, context.snapService);
		const snap = context.snapService.snapPointWithGuides(constrained, context.snapCandidates(), SNAP_TOLERANCE_PX * context.viewport.worldPerScreenPixel());
		this.deps.draft.cursor = snap.point;
		context.renderState.snapGuides = snap.guides;
		const corners = this.dragAnchor && rectangleCorners(this.dragAnchor, snap.point);
		if (corners) this.deps.setPoints(corners);
	}
	pointerUp(event: EditorPointerEvent): void {
		if (!this.dragAnchor) return;
		this.pointerMove(event);
		this.dragAnchor = null;
	}
	finish(): void { this.deps.finish(); }
	cancel(): void { if (this.context) this.context.renderState.snapGuides = []; this.dragAnchor = null; if (!this.deps.draft.busy) discardElementGeometry(this.deps.draft); }
	abandonGesture(): void { this.deps.draft.cursor = null; this.dragAnchor = null; if (this.context) this.context.renderState.snapGuides = []; }
	hasDraft(): boolean { return this.deps.draft.points.length > 0 || this.deps.draft.pendingInput || !!this.deps.draft.text.x || !!this.deps.draft.text.y; }
	/** A linear element trails the pointer from its last placed point. */
	tracksPointer(): boolean { return this.deps.draft.points.length > 0; }
	editCorner(index: number, point: Point | null): boolean {
		if (this.deps.blocked()) return false;
		const points = this.deps.draft.points, resolved = index === -1 ? points.length - 1 : index;
		if (resolved < 0 || resolved >= points.length) return false;
		// "Undo the last point" on a rectangle-mode item removes the whole outline rather than one
		// corner (PR #182 follow-up F-B) — the mode check itself lives in `pointsAfterUndo`, the
		// same helper `elementTask.ts`'s `undoPoint()` reaches for the other door.
		if (index === -1 && point === null && this.shaped()) return this.deps.setPoints(pointsAfterUndo(this.deps.draft));
		if (point) points.splice(resolved, 1, point); else points.splice(resolved, 1);
		return true;
	}
}
