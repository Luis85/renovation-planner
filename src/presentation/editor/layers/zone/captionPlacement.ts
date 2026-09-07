import type { Point } from '../../../../core/geometry/Point';

// Screen bounds include text/pin strokes; the persisted pin center never moves.
const CAPTION = { halfWidth: 91, top: -24, bottom: 32 }, PIN_RADIUS = 15, GAP = 6;

/** Move only the caption upward, clearing intersecting pins from bottom to top. */
export function captionOffsetY(anchor: Point, pins: readonly Point[], zoom: number): number {
	const obstacles = pins.filter(pin => Math.abs((pin.x - anchor.x) * zoom) < CAPTION.halfWidth + PIN_RADIUS + GAP)
		.map(pin => (pin.y - anchor.y) * zoom).toSorted((a, b) => b - a);
	let offset = 0;
	for (const y of obstacles) {
		if (offset + CAPTION.bottom > y - PIN_RADIUS - GAP && offset + CAPTION.top < y + PIN_RADIUS + GAP) {
			offset = y - PIN_RADIUS - GAP - CAPTION.bottom;
		}
	}
	return offset / zoom;
}
