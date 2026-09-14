import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { placedOutline, placementHeading } from '../../../domain/spatial/assetPlacement';
import type { ThemeTokens } from '../theme/themeTokens';
import { assetLabelLayout, ELEMENT_LABEL_FONT_PX } from '../labels/labelLayout';
import { elementFootprint, type ShapeLookup } from './elementFootprint';

const flat = (points: readonly Point[]): number[] => points.flatMap(point => [point.x, point.y]);

/** Konva configs for one placement, as data, so what a placement looks like is asked of a function. */
export function assetShapeConfig(element: NamedSpatialElement, shapeOf: ShapeLookup, state: { readonly selected: boolean; readonly hovered: boolean; readonly tokens: ThemeTokens; readonly zoom: number }) {
	const { selected, tokens, zoom } = state, shape = element.assetId ? shapeOf(element.assetId) : null;
	// Placed ONCE: for a readable shape `elementFootprint` answers exactly `placed.footprint`, so it is kept for the placeholder alone.
	const placed = shape ? placedOutline(element, shape) : null;
	const footprint = placed ? placed.footprint : elementFootprint(element, shapeOf), anchor = element.points[0], heading = placementHeading(element);
	const clearance = placed && (selected || state.hovered) ? placed.clearance : null, details = placed?.details ?? [];
	const ink = selected ? tokens.accent : tokens.zoneStroke;
	const outline = { points: flat(footprint), closed: true, stroke: ink, strokeWidth: (selected ? 3 : 2) / zoom };
	return {
		id: element.id,
		footprint: { ...outline, name: shape ? 'asset-footprint' : 'asset-placeholder', fill: tokens.canvasBackground, dash: shape ? [] : [6 / zoom, 4 / zoom] },
		// Symbols spec, Decision 4: array order, lighter than the outline of record; solid covers, dashed does not.
		// Details use zoneStroke at 1 px against the footprint's 2 px so the outline still reads as the object's edge.
		details: details.map(detail => ({ name: 'asset-detail', points: flat(detail.points), closed: true, stroke: tokens.zoneStroke, strokeWidth: 1 / zoom, listening: false,
			...(detail.line === 'solid' ? { fill: tokens.canvasBackground } : { dash: [4 / zoom, 3 / zoom] }) })),
		// Drawn after the details: a solid detail's fill covers the inner half of the footprint's stroke, so the edge is restroked on top, unfilled.
		edge: details.length > 0 ? { ...outline, name: 'asset-footprint-edge', listening: false } : null,
		cross: shape ? null : [flat([footprint[0], footprint[2]]), flat([footprint[1], footprint[3]])],
		tick: { name: 'asset-facing', points: flat([anchor, { x: anchor.x + 16 / zoom * Math.cos(heading), y: anchor.y + 16 / zoom * Math.sin(heading) }]), stroke: ink, strokeWidth: 2 / zoom },
		clearance: clearance ? { name: 'asset-clearance', points: flat(clearance), closed: true, stroke: tokens.zoneCaption, strokeWidth: 1 / zoom, dash: [6 / zoom, 4 / zoom] } : null,
		label: { ...assetLabelLayout(element, footprint, zoom), fontSize: ELEMENT_LABEL_FONT_PX / zoom, fill: tokens.zoneLabel, listening: false },
	};
}
