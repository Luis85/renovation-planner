import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement, SpatialElement, SpatialElementKind, SpatialElementMetadata } from '../../../domain/spatial/SpatialElement';
import { dimensionChain } from '../../../domain/spatial/dimensionChain';
import { formatMetres } from '../shell/formatLength';
import { measureLabelWidth } from '../labels/labelLayout';

/**
 * Where every drafting mark is drawn, in world millimetres, with its screen-constant sizes already divided by the zoom
 * (plan drafting tools design §6). Pure, so a test can ask what a mark IS; whether it reads as a plan is a capture.
 */
export const DRAFTING_TEXT_PX = 14;
const DIMENSION_TEXT_PX = 11;
export const GRID_RADIUS_PX = 10;
const MARKER_PX = 10;
const GRID_TEXT_PX = 12, TICK_PX = 5, EXTENSION_GAP_PX = 4, EXTENSION_OVERSHOOT_PX = 3, LABEL_GAP_PX = 4;

export interface DraftLine { readonly name: string; readonly points: readonly number[]; readonly strokeWidth: number; readonly closed?: boolean; readonly dash?: readonly number[]; readonly fill?: 'solid' | 'pattern' }
export interface DraftText { readonly name: string; readonly text: string; readonly x: number; readonly y: number; readonly fontSize: number; readonly width: number; readonly offsetX: number; readonly offsetY: number; readonly rotation: number }
export interface DraftCircle { readonly name: string; readonly x: number; readonly y: number; readonly radius: number; readonly strokeWidth: number }
export interface DraftMarks { readonly lines: readonly DraftLine[]; readonly texts: readonly DraftText[]; readonly circles: readonly DraftCircle[] }
const NONE: DraftMarks = { lines: [], texts: [], circles: [] };

const flat = (points: readonly Point[]): number[] => points.flatMap(point => [point.x, point.y]);
const step = (point: Point, by: Point, distance: number): Point => ({ x: point.x + by.x * distance, y: point.y + by.y * distance });
function unit(from: Point, to: Point): Point | null {
	const length = Math.hypot(to.x - from.x, to.y - from.y);
	return length > 0 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length } : null;
}
/** One line of text centred on `at`: vertically centred with no `lift`, otherwise sitting `lift` above `at` in its own rotated frame. */
function text(name: string, words: string, at: Point, zoom: number, style: { fontPx: number; rotation?: number; lift?: number }): DraftText {
	const { fontPx, rotation = 0, lift = 0 } = style;
	const width = measureLabelWidth(words, fontPx) / zoom, fontSize = fontPx / zoom;
	return { name, text: words, x: at.x, y: at.y, fontSize, width, offsetX: width / 2, offsetY: lift > 0 ? fontSize + lift : fontSize / 2, rotation };
}
/** The line's bearing in degrees, turned half a revolution when it would read upside down (DIN 406 / ISO 129: an exactly vertical chain reads bottom to top, never top to bottom). */
function uprightDegrees(direction: Point): number {
	const degrees = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
	if (degrees >= 90) return degrees - 180;
	return degrees < -90 ? degrees + 180 : degrees;
}

/** The dimension line, an extension line from every point to it, a 45° tick at every foot, and each non-zero segment's length over it. */
function dimensionMarks(element: NamedSpatialElement, zoom: number): DraftMarks {
	const chain = dimensionChain(element.points, element.offset ?? 0);
	if (!chain) return NONE;
	const { direction, normal, feet } = chain, px = 1 / zoom, reach = Math.SQRT1_2 * TICK_PX * px;
	const tick = { x: (direction.x + normal.x) * reach, y: (direction.y + normal.y) * reach };
	const along = (point: Point): number => point.x * direction.x + point.y * direction.y;
	const ordered = feet.toSorted((a, b) => along(a) - along(b));
	const extensions = element.points.map((point, index): DraftLine => {
		const foot = feet[index], side = Math.sign((foot.x - point.x) * normal.x + (foot.y - point.y) * normal.y) || 1;
		return { name: 'drafting-dimension-extension', points: flat([step(point, normal, side * EXTENSION_GAP_PX * px), step(foot, normal, side * EXTENSION_OVERSHOOT_PX * px)]), strokeWidth: px };
	});
	const ticks = feet.map((foot): DraftLine => ({ name: 'drafting-dimension-tick', points: flat([step(foot, tick, -1), step(foot, tick, 1)]), strokeWidth: 1.5 * px }));
	const rotation = uprightDegrees(direction);
	const texts = chain.lengths.flatMap((length, index) => length === 0 ? [] : [text('drafting-dimension-text', formatMetres(length),
		{ x: (feet[index].x + feet[index + 1].x) / 2, y: (feet[index].y + feet[index + 1].y) / 2 }, zoom, { fontPx: DIMENSION_TEXT_PX, rotation, lift: LABEL_GAP_PX * px })]);
	return { lines: [{ name: 'drafting-dimension-line', points: flat([ordered[0], ordered[ordered.length - 1]]), strokeWidth: px }, ...extensions, ...ticks], texts, circles: [] };
}

/** A dash-dot cut line, a filled triangle at each end on the side it looks at, and its name beside each triangle. */
function sectionMarks(element: NamedSpatialElement, zoom: number): DraftMarks {
	if (element.points.length !== 2) return NONE;
	const [start, end] = element.points, direction = unit(start, end);
	if (!direction) return NONE;
	const px = 1 / zoom, size = MARKER_PX * px, look = element.flipped ? -1 : 1, normal = { x: -direction.y * look, y: direction.x * look };
	const arrow = (at: Point): DraftLine => ({ name: 'drafting-section-arrow', points: flat([step(at, direction, -size / 2), step(at, direction, size / 2), step(at, normal, size)]), closed: true, fill: 'solid', strokeWidth: px });
	const label = (at: Point): DraftText => text('drafting-section-label', element.name, step(at, normal, size + (LABEL_GAP_PX + DRAFTING_TEXT_PX / 2) * px), zoom, { fontPx: DRAFTING_TEXT_PX });
	return { lines: [{ name: 'drafting-section-line', points: flat([start, end]), dash: [12 * px, 3 * px, 2 * px, 3 * px], strokeWidth: px }, arrow(start), arrow(end)], texts: [label(start), label(end)], circles: [] };
}

/** A hollow triangle at the anchor pointing the way the view looks, and the marker's name behind it. */
function viewMarks(element: NamedSpatialElement, zoom: number): DraftMarks {
	if (element.points.length !== 2) return NONE;
	const [anchor, facing] = element.points, direction = unit(anchor, facing);
	if (!direction) return NONE;
	const px = 1 / zoom, size = MARKER_PX * px, normal = { x: -direction.y, y: direction.x }, base = step(anchor, direction, -size / 2);
	return {
		lines: [{ name: 'drafting-view-arrow', points: flat([step(anchor, direction, size), step(base, normal, size * 0.8), step(base, normal, -size * 0.8)]), closed: true, strokeWidth: 1.5 * px }],
		texts: [text('drafting-view-label', element.name, step(anchor, direction, -(size + (LABEL_GAP_PX + DRAFTING_TEXT_PX / 2) * px)), zoom, { fontPx: DRAFTING_TEXT_PX })],
		circles: [],
	};
}

const MARKS: Readonly<Partial<Record<SpatialElementKind, (element: NamedSpatialElement, zoom: number) => DraftMarks>>> = {
	dimension: dimensionMarks,
	section: sectionMarks,
	view: viewMarks,
	hatch: (element, zoom) => ({ lines: [{ name: 'drafting-hatch', points: flat(element.points), closed: true, fill: 'pattern', strokeWidth: 1 / zoom }], texts: [], circles: [] }),
	text: (element, zoom) => ({ lines: [], texts: element.points.slice(0, 1).map(point => text('drafting-text', element.name, point, zoom, { fontPx: DRAFTING_TEXT_PX })), circles: [] }),
	boundary: (element, zoom) => ({ lines: [{ name: 'drafting-boundary', points: flat(element.points), dash: [16 / zoom, 8 / zoom], strokeWidth: 1.5 / zoom }], texts: [], circles: [] }),
	grid: (element, zoom) => ({
		lines: [],
		texts: element.points.slice(0, 1).map(point => text('drafting-grid-label', element.name, point, zoom, { fontPx: GRID_TEXT_PX })),
		circles: element.points.slice(0, 1).map(point => ({ name: 'drafting-grid', x: point.x, y: point.y, radius: GRID_RADIUS_PX / zoom, strokeWidth: 1 / zoom })),
	}),
};

/** Every line, text and circle a drafting mark draws; nothing for any other kind. */
export function draftingMarks(element: NamedSpatialElement, zoom: number): DraftMarks {
	return MARKS[element.kind]?.(element, zoom) ?? NONE;
}

/** What a screen-constant mark, or a chain's band, needs to be hit: the zoom it is drawn at and, for a text, its words. */
export interface DraftingHitContext { readonly zoom: number; readonly names: ReadonlyMap<string, string> }
const LINE_HIT_PX = 6;

/** The one way a `DraftingHitContext` is built, so the tool, the interaction layer and the context menu read the same list (plan drafting tools task 5, finding 2). */
export function draftingHitContext(zoom: number, named: readonly SpatialElementMetadata[] | undefined): DraftingHitContext {
	return { zoom, names: new Map(named?.map(item => [item.id, item.name])) };
}

function box(centre: Point, halfWidth: number, halfHeight: number): Point[] {
	return [{ x: centre.x - halfWidth, y: centre.y - halfHeight }, { x: centre.x + halfWidth, y: centre.y - halfHeight },
		{ x: centre.x + halfWidth, y: centre.y + halfHeight }, { x: centre.x - halfWidth, y: centre.y + halfHeight }];
}
/** The band between a chain's points and its line, padded so a chain whose line lies on its own points is still hit. */
function dimensionBand(element: SpatialElement, zoom: number): Point[] | undefined {
	const chain = dimensionChain(element.points, element.offset ?? 0), origin = element.points[0];
	if (!chain || !origin) return undefined;
	const { direction, normal } = chain, pad = LINE_HIT_PX / zoom, offset = element.offset ?? 0;
	const along = element.points.map(point => (point.x - origin.x) * direction.x + (point.y - origin.y) * direction.y);
	const across = element.points.map(point => (point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y);
	const start = Math.min(...along) - pad, end = Math.max(...along) + pad, low = Math.min(offset, ...across) - pad, high = Math.max(offset, ...across) + pad;
	const at = (a: number, b: number): Point => ({ x: origin.x + direction.x * a + normal.x * b, y: origin.y + direction.y * a + normal.y * b });
	return [at(start, low), at(end, low), at(end, high), at(start, high)];
}
/** The world polygon a drafting mark is hit by at `context.zoom`; undefined where its stored points already answer (a line, an outline). */
export function draftingHitPoints(element: SpatialElement, context: DraftingHitContext): readonly Point[] | undefined {
	const point = element.points[0], zoom = context.zoom;
	if (element.kind === 'dimension') return dimensionBand(element, zoom);
	if (!point) return undefined;
	if (element.kind === 'grid') return box(point, GRID_RADIUS_PX / zoom, GRID_RADIUS_PX / zoom);
	if (element.kind === 'view') return box(point, MARKER_PX / zoom, MARKER_PX / zoom);
	if (element.kind !== 'text') return undefined;
	return box(point, measureLabelWidth(context.names.get(element.id) ?? '', DRAFTING_TEXT_PX) / zoom / 2, DRAFTING_TEXT_PX / zoom / 2);
}
