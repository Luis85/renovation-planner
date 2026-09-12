import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import type { Point } from '../../../core/geometry/Point';
import type { Vector } from '../../../core/geometry/Vector';
import { elementLength, type NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { formatMetres } from '../shell/formatLength';
import { CAPTION_BOUNDS_PX } from '../layers/zone/captionPlacement';
import { elementFootprint, type ShapeLookup } from '../elements/elementFootprint';

/**
 * Where every canvas caption is DRAWN and what box GRABS it (ADR-0029), in world millimetres. The
 * renderers and `labelActions` both ask here, so a caption cannot be drawn in one place and grabbed
 * in another. Room captions are placed by `roomCaptionAnchor`, beside the obstacle rules they share.
 */

/** An element or asset name tag's text size, in screen px. */
export const ELEMENT_LABEL_FONT_PX = 12;
const ELEMENT_LABEL_GAP_PX = 18;

const offsetBy = (point: Point, offset: Vector | undefined): Point => offset ? { x: point.x + offset.dx, y: point.y + offset.dy } : point;

/** An element's name tag: above its first point (a valid element always has one), moved by a dragged offset. */
export function elementLabelLayout(element: NamedSpatialElement, zoom: number): { readonly x: number; readonly y: number; readonly text: string } {
	const point = element.points[0];
	const at = offsetBy({ x: point.x, y: point.y - ELEMENT_LABEL_GAP_PX / zoom }, element.labelOffset);
	return { ...at, text: element.kind === 'measurement' ? element.name + ' · ' + formatMetres(elementLength(element)) + ' m' : element.name };
}

/** An asset's name tag: above the footprint it draws, never its stored anchor → facing pair, moved by a dragged offset. */
export function assetLabelLayout(element: NamedSpatialElement, footprint: readonly Point[], zoom: number): { readonly x: number; readonly y: number; readonly text: string } {
	const anchor = element.points[0];
	return { ...offsetBy({ x: anchor.x, y: Math.min(...footprint.map(point => point.y)) - ELEMENT_LABEL_GAP_PX / zoom }, element.labelOffset), text: element.name };
}

/** Either tag, by the element's kind — what a caption drag asks, so it never re-decides which layout an element draws. */
export function elementCaptionLayout(element: NamedSpatialElement, shapeOf: ShapeLookup, zoom: number): { readonly x: number; readonly y: number; readonly text: string } {
	return element.kind === 'asset' ? assetLabelLayout(element, elementFootprint(element, shapeOf), zoom) : elementLabelLayout(element, zoom);
}

let context: CanvasRenderingContext2D | null | undefined;

/**
 * Measured with the same 2D canvas and default family (Konva's `Arial`) the tag is drawn with.
 * `createEl`, not `document.createElement` (`obsidianmd/prefer-create-el`, `pdfRaster.ts`'s same
 * choice) — a global only Obsidian and a jsdom test that called `installObsidianDom()` provide,
 * so `typeof createEl === 'undefined'` is also this module's node-test detection.
 */
export function measureLabelWidth(text: string, fontPx: number): number {
	context ??= typeof createEl === 'undefined' ? null : createEl('canvas').getContext('2d');
	// ponytail: an estimate only where no 2D context exists (a node test, or a jsdom one with no
	// Obsidian DOM installed); Obsidian itself always has one.
	if (!context) return text.length * fontPx * 0.6;
	context.font = `${fontPx}px Arial`;
	return context.measureText(text).width;
}

/** A name tag's world box: its top-left at the layout, one line tall. */
export function textLabelBounds(layout: { readonly x: number; readonly y: number; readonly text: string }, zoom: number, measure: (text: string, fontPx: number) => number = measureLabelWidth): BoundingBox {
	return { min: { x: layout.x, y: layout.y }, max: { x: layout.x + measure(layout.text, ELEMENT_LABEL_FONT_PX) / zoom, y: layout.y + ELEMENT_LABEL_FONT_PX / zoom } };
}

/** A room caption's world box around the drawn anchor; `bottom` is `captionBottom(…)`, lower while a detail-plans line shows. */
export function roomCaptionBounds(anchor: Point, zoom: number, bottom: number): BoundingBox {
	return {
		min: { x: anchor.x - CAPTION_BOUNDS_PX.halfWidth / zoom, y: anchor.y + CAPTION_BOUNDS_PX.top / zoom },
		max: { x: anchor.x + CAPTION_BOUNDS_PX.halfWidth / zoom, y: anchor.y + bottom / zoom },
	};
}

/** A drawn caption a press can grab: its world box, and the offset it is drawn at NOW (an undragged room caption's pin displacement included). */
export interface LabelHit { readonly id: string; readonly bounds: BoundingBox; readonly offset: Vector }
