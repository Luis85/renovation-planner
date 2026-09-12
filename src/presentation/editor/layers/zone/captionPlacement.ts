import type { Point } from '../../../../core/geometry/Point';
import type { BoundingBox } from '../../../../core/geometry/BoundingBox';
import type { Vector } from '../../../../core/geometry/Vector';
import { labelAnchor } from './ZoneRenderModel';
import { tr } from '../../../i18n/strings';

export interface NumberedPin extends Point { readonly number: number }

/** Allow the complete number alongside a 16px host icon, including larger evidence lists. */
export function evidencePinWidth(number: number): number { return Math.max(44, 30 + String(number).length * 9); }

/** A room caption's name-and-area block, in screen px around its anchor: what obstacles clear. A caption drag grabs the drawn text instead (`ROOM_CAPTION_TEXT`). */
const CAPTION_BOUNDS_PX = { halfWidth: 91, top: -24, bottom: 32 } as const;
const CAPTION = CAPTION_BOUNDS_PX, PIN_HALF_HEIGHT = 15, GAP = 6, TEXT_PX = 14;

/**
 * A room caption's drawn lines, in screen px about its anchor: `ZoneShape` draws exactly these and
 * `roomCaptionBounds` grabs exactly these (ADR-0029), so the two cannot drift. Konva's `offsetY` LIFTS
 * a line by its value; the area line has no fixed height, and one unwrapped line is its font size tall.
 */
export const ROOM_CAPTION_TEXT = {
	width: 180,
	name: { offsetY: TEXT_PX * 1.6, fontSize: TEXT_PX + 2, height: TEXT_PX + 5 },
	area: { offsetY: 0, fontSize: TEXT_PX },
	detail: { offsetY: -TEXT_PX * 1.3, fontSize: TEXT_PX - 2, height: TEXT_PX },
} as const;

/** Zone id → its detail-plans caption line: the plan's name for one, a count for several (ADR-0028). Drawn by `ZoneLayer`, grabbed by a caption drag. */
export function detailPlanCaptions(details: readonly { readonly name: string; readonly parentZoneId: string }[]): ReadonlyMap<string, string> {
	const byZone = new Map<string, string[]>();
	for (const detail of details) byZone.set(detail.parentZoneId, [...byZone.get(detail.parentZoneId) ?? [], detail.name]);
	return new Map([...byZone].map(([zoneId, names]) => [zoneId, names.length === 1
		? tr('editor.input.detail-plan-caption-one', { name: names[0] })
		: tr('editor.input.detail-plan-caption-many', { count: String(names.length) })]));
}

/** Where a caption's third line — a zone's detail plans — ends, in the same screen pixels as `CAPTION`. */
export const DETAIL_CAPTION_BOTTOM = 50;

/**
 * Prefer the upward clearance; a clipped result may use the nearest clear downward position.
 * `bottom` grows to `DETAIL_CAPTION_BOTTOM` while the caption carries a third line.
 */
export function captionOffsetY(anchor: Point, pins: readonly NumberedPin[], zoom: number, dimensions: readonly BoundingBox[] = [],
	{ viewport = null, bottom: blockBottom = CAPTION.bottom }: { readonly viewport?: BoundingBox | null; readonly bottom?: number } = {}): number {
	const pinBounds = pins.filter(pin => Math.abs((pin.x - anchor.x) * zoom) < CAPTION.halfWidth + evidencePinWidth(pin.number) / 2 + 1 + GAP)
		.map(pin => ({ top: (pin.y - anchor.y) * zoom - PIN_HALF_HEIGHT, bottom: (pin.y - anchor.y) * zoom + PIN_HALF_HEIGHT }));
	const dimensionBounds = dimensions.filter(box => (box.min.x - anchor.x) * zoom < CAPTION.halfWidth + GAP && (box.max.x - anchor.x) * zoom > -CAPTION.halfWidth - GAP)
		.map(box => ({ top: (box.min.y - anchor.y) * zoom, bottom: (box.max.y - anchor.y) * zoom }));
	const obstacles = [...pinBounds, ...dimensionBounds].toSorted((a, b) => b.top - a.top);
	let offset = 0;
	for (const box of obstacles) {
		if (offset + blockBottom > box.top - GAP && offset + CAPTION.top < box.bottom + GAP) {
			offset = box.top - GAP - blockBottom;
		}
	}
	if (offset === 0 || viewport === null) return offset / zoom;
	const top = (viewport.min.y - anchor.y) * zoom, bottom = (viewport.max.y - anchor.y) * zoom;
	// An offscreen Room is not a request to bring its caption back into the viewport.
	if (blockBottom < top || CAPTION.top > bottom) return offset / zoom;
	const visible = (value: number) => value + CAPTION.top >= top && value + blockBottom <= bottom;
	if (visible(offset)) return offset / zoom;
	const below = clearBelow(obstacles, blockBottom);
	// No clear vertical slot can exist when controls cover the whole canvas at this x.
	// Retain the original caption in that case; never hide it or invent a geometry change.
	return visible(below) ? below / zoom : 0;
}

/** The nearest downward displacement clear of every obstacle, in screen pixels. */
function clearBelow(obstacles: readonly { readonly top: number; readonly bottom: number }[], blockBottom: number): number {
	let below = 0;
	for (const box of obstacles.toSorted((a, b) => a.bottom - b.bottom)) {
		if (below + blockBottom > box.top - GAP && below + CAPTION.top < box.bottom + GAP) below = box.bottom + GAP - CAPTION.top;
	}
	return below;
}

/** Pins clear captions only while the evidence session and the annotation layer both show them; `ZoneLayer` and a caption drag ask this once. */
export function captionPins<T extends NumberedPin>(pins: readonly T[], sessionVisible: boolean, annotationVisible: boolean): readonly T[] {
	return sessionVisible && annotationVisible ? pins : [];
}

/** Where a room caption's block ends, in screen px: lower while it carries a third line naming its detail plans (ADR-0028). */
export function captionBottom(detailed: boolean): number {
	return detailed ? DETAIL_CAPTION_BOTTOM : CAPTION.bottom;
}

/**
 * Where a room caption is DRAWN (ADR-0029). A dragged caption sits exactly at its automatic anchor
 * plus its offset — a placement the renovator chose wins — and only an undragged one is displaced
 * around pins and dimension labels.
 */
export function roomCaptionAnchor(zone: { readonly points: readonly Point[]; readonly bulges?: readonly number[]; readonly labelOffset?: Vector | null }, zoom: number, pins: readonly NumberedPin[], dimensions: readonly BoundingBox[], options: { readonly viewport: BoundingBox | null; readonly bottom: number }): Point {
	const anchor = labelAnchor(zone.points, zone.bulges);
	if (zone.labelOffset) return { x: anchor.x + zone.labelOffset.dx, y: anchor.y + zone.labelOffset.dy };
	return { x: anchor.x, y: anchor.y + captionOffsetY(anchor, pins, zoom, dimensions, options) };
}
