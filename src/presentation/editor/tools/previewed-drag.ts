import type { EditorContext } from './editor-context';
import type { EditorPointerEvent } from './editor-tool';

/**
 * The drag skeleton `ElementResize` and `OpeningResize` share: a move previews whatever the
 * gesture proposes, a blocked write cancels, and a primary-button drop hands the last proposal
 * to `drop` — or cancels when there is none. What a proposal IS, and what previewing and
 * dropping it write, is each subclass's own.
 */
export abstract class PreviewedDrag<G, N> {
	protected gesture: G | null = null;
	get active(): boolean { return this.gesture !== null; }

	/** The result at `event`, or `null` where there is nothing to preview. */
	protected abstract proposed(gesture: G, event: EditorPointerEvent): N | null;
	protected abstract preview(gesture: G, next: N): void;
	/** The drop, after the gesture has ended: previews `next` and commits it. */
	protected abstract drop(gesture: G, next: N): void;
	abstract cancel(): void;

	move(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture) return;
		if (context.writesBlocked()) { this.cancel(); return; }
		const next = this.proposed(gesture, event);
		if (next) this.preview(gesture, next);
	}

	finish(context: EditorContext, event: EditorPointerEvent): void {
		const gesture = this.gesture;
		if (!gesture || event.button !== 'primary') return;
		const next = context.writesBlocked() ? null : this.proposed(gesture, event);
		if (!next) { this.cancel(); return; }
		this.gesture = null;
		this.drop(gesture, next);
	}
}
