import type { Opening, Wall } from '../../../domain/spatial/Structure';
import { projectOntoWall } from '../../../domain/spatial/Structure';
import { openingOffsetAt, resizedOpening } from '../../../domain/spatial/openingGeometry';
import { CLICK_EPSILON_PX } from '../handleMetrics';
import type { EditorContext } from '../tools/editor-context';
import type { EditorPointerEvent } from '../tools/editor-tool';

/** Which of a selected opening's three circle grips is being dragged; the arrows are taps, not drags. */
export type OpeningDragGrip = 'width-start' | 'width-end' | 'move';

export interface OpeningResizeDeps {
	/** The opening and its host as the CANVAS has them, for previewing; the write re-reads its own baseline. */
	readonly openingTarget?: (id: string) => { readonly opening: Opening; readonly host: Wall } | null;
	readonly previewOpening?: (id: string | null, next?: Opening) => void;
	readonly commitOpening?: (id: string, next: Opening) => void;
}

interface Gesture {
	readonly id: string;
	readonly grip: OpeningDragGrip;
	readonly opening: Opening;
	readonly host: Wall;
	readonly start: { readonly x: number; readonly y: number };
	readonly context: EditorContext;
	dragging: boolean;
}

/**
 * A width or move grip drag. The same shape as `ElementResize` — a press is not yet an edit, travel
 * past the click epsilon starts one, an illegal proposal leaves the last valid preview standing,
 * and the drop stays previewed until the write is read back — with one difference: this gesture is
 * ONE-DIMENSIONAL. The pointer is projected onto the host and only the offset it lands at matters,
 * so there is no snap and no snap-guide write (opening handles design, Decision 5).
 *
 * The move grip goes through `openingOffsetAt`, which is the function the click-to-place tool
 * already uses, so a drag and a click put the opening in the same place rather than two places that
 * agree by coincidence.
 */
export class OpeningResize {
	private gesture: Gesture | null = null;
	constructor(private readonly deps: OpeningResizeDeps) {}
	get active(): boolean { return this.gesture !== null; }

	start(context: EditorContext, event: EditorPointerEvent, id: string, grip: OpeningDragGrip): void {
		const found = this.deps.openingTarget?.(id);
		if (!found || context.writesBlocked() || event.modifiers.alt || !this.deps.commitOpening) return;
		this.gesture = { id, grip, opening: found.opening, host: found.host, start: event.worldPoint, context, dragging: false };
	}

	/** The opening at `event`: `null` below the click epsilon, or where the transform itself refuses. */
	private proposed(gesture: Gesture, event: EditorPointerEvent): Opening | null {
		const scale = gesture.context.viewport.worldPerScreenPixel();
		if (Math.hypot(event.worldPoint.x - gesture.start.x, event.worldPoint.y - gesture.start.y) > CLICK_EPSILON_PX * scale) gesture.dragging = true;
		if (!gesture.dragging) return null;
		if (gesture.grip === 'move') {
			const offset = openingOffsetAt(gesture.host, event.worldPoint, gesture.opening.width);
			return offset === null ? null : { ...gesture.opening, offset };
		}
		const at = projectOntoWall(gesture.host, event.worldPoint).offset;
		return resizedOpening(gesture.opening, gesture.host, gesture.grip === 'width-start' ? 'start' : 'end', at);
	}

	move(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture) return;
		if (context.writesBlocked()) { this.cancel(); return; }
		const next = this.proposed(gesture, event);
		if (next) this.deps.previewOpening?.(gesture.id, next);
	}

	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		const next = context.writesBlocked() ? null : this.proposed(gesture, event);
		if (!next) { this.cancel(); return; }
		// Left previewing at the drop; the write clears it once read back, as `ElementResize` does.
		this.gesture = null;
		this.deps.previewOpening?.(gesture.id, next);
		this.deps.commitOpening?.(gesture.id, next);
	}

	cancel(): void {
		this.gesture = null;
		this.deps.previewOpening?.(null);
	}
}
