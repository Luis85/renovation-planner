import type { Point } from '../../../../core/geometry/Point';
import type { BoundingBox } from '../../../../core/geometry/BoundingBox';

export interface NumberedPin extends Point { readonly number: number }

/** Allow the complete number alongside a 16px host icon, including larger evidence lists. */
export function evidencePinWidth(number: number): number { return Math.max(44, 30 + String(number).length * 9); }

// Screen bounds include text/pin strokes; the persisted pin center never moves.
const CAPTION = { halfWidth: 91, top: -24, bottom: 32 }, PIN_HALF_HEIGHT = 15, GAP = 6;

/** Where a caption's third line — a zone's detail plans — ends, in the same screen pixels as `CAPTION`. */
export const DETAIL_CAPTION_BOTTOM = 50;

/**
 * Prefer the upward clearance; a clipped result may use the nearest clear downward position.
 * `bottom` grows to `DETAIL_CAPTION_BOTTOM` while the caption carries a third line.
 */
export function captionOffsetY(anchor: Point, pins: readonly NumberedPin[], zoom: number, dimensions: readonly BoundingBox[] = [],
	{ viewport = null, bottom: captionBottom = CAPTION.bottom }: { readonly viewport?: BoundingBox | null; readonly bottom?: number } = {}): number {
	const pinBounds = pins.filter(pin => Math.abs((pin.x - anchor.x) * zoom) < CAPTION.halfWidth + evidencePinWidth(pin.number) / 2 + 1 + GAP)
		.map(pin => ({ top: (pin.y - anchor.y) * zoom - PIN_HALF_HEIGHT, bottom: (pin.y - anchor.y) * zoom + PIN_HALF_HEIGHT }));
	const dimensionBounds = dimensions.filter(box => (box.min.x - anchor.x) * zoom < CAPTION.halfWidth + GAP && (box.max.x - anchor.x) * zoom > -CAPTION.halfWidth - GAP)
		.map(box => ({ top: (box.min.y - anchor.y) * zoom, bottom: (box.max.y - anchor.y) * zoom }));
	const obstacles = [...pinBounds, ...dimensionBounds].toSorted((a, b) => b.top - a.top);
	let offset = 0;
	for (const box of obstacles) {
		if (offset + captionBottom > box.top - GAP && offset + CAPTION.top < box.bottom + GAP) {
			offset = box.top - GAP - captionBottom;
		}
	}
	if (offset === 0 || viewport === null) return offset / zoom;
	const top = (viewport.min.y - anchor.y) * zoom, bottom = (viewport.max.y - anchor.y) * zoom;
	// An offscreen Room is not a request to bring its caption back into the viewport.
	if (captionBottom < top || CAPTION.top > bottom) return offset / zoom;
	const visible = (value: number) => value + CAPTION.top >= top && value + captionBottom <= bottom;
	if (visible(offset)) return offset / zoom;
	const below = clearBelow(obstacles, captionBottom);
	// No clear vertical slot can exist when controls cover the whole canvas at this x.
	// Retain the original caption in that case; never hide it or invent a geometry change.
	return visible(below) ? below / zoom : 0;
}

/** The nearest downward displacement clear of every obstacle, in screen pixels. */
function clearBelow(obstacles: readonly { readonly top: number; readonly bottom: number }[], captionBottom: number): number {
	let below = 0;
	for (const box of obstacles.toSorted((a, b) => a.bottom - b.bottom)) {
		if (below + captionBottom > box.top - GAP && below + CAPTION.top < box.bottom + GAP) below = box.bottom + GAP - CAPTION.top;
	}
	return below;
}
