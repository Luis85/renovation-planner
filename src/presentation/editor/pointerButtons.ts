import type { PanButton } from './viewport/pan-override';

/**
 * What a DOM pointer event's BUTTON means to this editor — the vocabulary `PlanCanvas` routes
 * on, extracted when that file crossed its line cap and kept together because the three facts
 * here are one fact: `PointerEvent.button` and `PointerEvent.buttons` are different numberings
 * of the same hardware, and confusing them has produced seven defects in this canvas.
 *
 * `button` counts 0/1/2 for primary/auxiliary/secondary and names what CHANGED; `buttons` is a
 * bitmask of what is currently HELD, where auxiliary is 4 and secondary is 2 — the two
 * non-primary values swapped relative to each other.
 */

/**
 * The `buttons` bit the primary button sets. Camera mode's own drag is the one gesture whose
 * owning button is fixed, since the filter above `beginPan` admits no other.
 */
export const PRIMARY_BUTTON_BIT = 1;

/** `MouseEvent.button` for the middle button — the `button` numbering, not the `buttons` mask. */
export const MIDDLE_MOUSE_BUTTON = 1;

/**
 * Which button an event carries, as the ONE mapping every consumer reads. It was spelled twice
 * for a while, which is two chances for `auxiliary` to mean different buttons in the two halves
 * of one press.
 *
 * **`null` for anything it does not recognise, which is the whole of this signature's job.**
 * `PointerEvent.button` runs past the three everyone remembers: **3 is a mouse's Back, 4 its
 * Forward, 5 a pen's ERASER**, and `-1` is "no button changed state", which every plain move
 * carries. Answering `primary` for all of them — an `else` rather than a case — meant that with
 * space armed a Back press CLAIMED the camera, took the pointer capture and had its default
 * suppressed, which on that button is the browser's own navigation. Declining is not the same
 * as mapping to something, and a caller that wants a fallback says so at its own call site.
 */
export function panButtonOf(event: PointerEvent): PanButton | null {
	switch (event.button) {
		case 0:
			return 'primary';
		case 1:
			return 'auxiliary';
		case 2:
			return 'secondary';
		default:
			return null;
	}
}
