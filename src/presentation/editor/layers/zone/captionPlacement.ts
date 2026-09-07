import type { Point } from '../../../../core/geometry/Point';

export interface NumberedPin extends Point { readonly number: number }

/** Allow the complete number alongside a 16px host icon, including larger evidence lists. */
export function evidencePinWidth(number: number): number { return Math.max(44, 30 + String(number).length * 9); }

// Screen bounds include text/pin strokes; the persisted pin center never moves.
const CAPTION = { halfWidth: 91, top: -24, bottom: 32 }, PIN_HALF_HEIGHT = 15, GAP = 6;

/** Move only the caption upward, clearing intersecting pins from bottom to top. */
export function captionOffsetY(anchor: Point, pins: readonly NumberedPin[], zoom: number): number {
	const obstacles = pins.filter(pin => Math.abs((pin.x - anchor.x) * zoom) < CAPTION.halfWidth + evidencePinWidth(pin.number) / 2 + 1 + GAP)
		.map(pin => (pin.y - anchor.y) * zoom).toSorted((a, b) => b - a);
	let offset = 0;
	for (const y of obstacles) {
		if (offset + CAPTION.bottom > y - PIN_HALF_HEIGHT - GAP && offset + CAPTION.top < y + PIN_HALF_HEIGHT + GAP) {
			offset = y - PIN_HALF_HEIGHT - GAP - CAPTION.bottom;
		}
	}
	return offset / zoom;
}
