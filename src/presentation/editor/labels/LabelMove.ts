import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import type { LabelHit } from './labelLayout';

export interface LabelMoveDeps {
	/** The captions a press could grab right now: selected, drawn and editable (ADR-0029). */
	readonly labelHits?: () => readonly LabelHit[];
	/** Saves a dropped caption, and clears `renderState.labelPreview` once the write has been read back. */
	readonly moveLabel?: (id: string, offset: Vector) => void;
}

interface LabelGesture { readonly id: string; readonly start: Point; readonly offset: Vector; readonly context: EditorContext }

const offsetAt = (gesture: LabelGesture, event: EditorPointerEvent): Vector =>
	({ dx: gesture.offset.dx + event.worldPoint.x - gesture.start.x, dy: gesture.offset.dy + event.worldPoint.y - gesture.start.y });

/** A caption drag previews only, and a release hands one offset to the write. No snapping: a caption is an annotation. */
export class LabelMove {
	private gesture: LabelGesture | null = null;
	constructor(private readonly deps: LabelMoveDeps) {}
	get active(): boolean { return this.gesture !== null; }
	start(context: EditorContext, event: EditorPointerEvent, id: string): void {
		const hit = this.deps.labelHits?.().find(item => item.id === id);
		if (!hit || !this.deps.moveLabel || context.writesBlocked()) return;
		this.gesture = { id, start: event.worldPoint, offset: hit.offset, context };
	}
	/** Answers whether a caption drag consumed the move, so `SelectTool` asks once instead of checking `active` first. */
	move(event: EditorPointerEvent): boolean {
		const gesture = this.gesture;
		if (!gesture) return false;
		gesture.context.renderState.labelPreview = { id: gesture.id, offset: offsetAt(gesture, event) };
		return true;
	}
	/** Answers whether a caption drag consumed the release; a non-primary release is consumed and ends nothing. */
	finish(event: EditorPointerEvent): boolean {
		const gesture = this.gesture;
		if (!gesture) return false;
		if (event.button !== 'primary') return true;
		this.gesture = null;
		const { context } = gesture;
		const travelled = Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y);
		if (travelled <= CLICK_EPSILON_PX * context.viewport.worldPerScreenPixel() || context.writesBlocked()) { context.renderState.labelPreview = null; return true; }
		const offset = offsetAt(gesture, event);
		// Left previewing at the drop; `moveLabel` clears it once the write has been read back.
		context.renderState.labelPreview = { id: gesture.id, offset };
		this.deps.moveLabel?.(gesture.id, offset);
		return true;
	}
	cancel(): void {
		if (this.gesture) this.gesture.context.renderState.labelPreview = null;
		this.gesture = null;
	}
}
