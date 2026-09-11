import type { Point } from '../../../core/geometry/Point';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { placedOutline, placementHeading } from '../../../domain/spatial/assetPlacement';
import type { ThemeTokens } from '../theme/themeTokens';
import { elementFootprint, type ShapeLookup } from './elementFootprint';

const flat = (points: readonly Point[]): number[] => points.flatMap(point => [point.x, point.y]);

/** Konva configs for one placement, as data, so what a placement looks like is asked of a function. */
export function assetShapeConfig(element: NamedSpatialElement, shapeOf: ShapeLookup, state: { readonly selected: boolean; readonly hovered: boolean; readonly tokens: ThemeTokens; readonly zoom: number }) {
	const { selected, tokens, zoom } = state, shape = element.assetId ? shapeOf(element.assetId) : null;
	const footprint = elementFootprint(element, shapeOf), anchor = element.points[0], heading = placementHeading(element);
	const clearance = shape && (selected || state.hovered) ? placedOutline(element, shape).clearance : null;
	return {
		id: element.id,
		footprint: { name: shape ? 'asset-footprint' : 'asset-placeholder', points: flat(footprint), closed: true, stroke: selected ? tokens.accent : tokens.zoneStroke,
			strokeWidth: (selected ? 3 : 2) / zoom, fill: tokens.canvasBackground, dash: shape ? [] : [6 / zoom, 4 / zoom] },
		cross: shape ? null : [flat([footprint[0], footprint[2]]), flat([footprint[1], footprint[3]])],
		tick: { name: 'asset-facing', points: flat([anchor, { x: anchor.x + 16 / zoom * Math.cos(heading), y: anchor.y + 16 / zoom * Math.sin(heading) }]), stroke: selected ? tokens.accent : tokens.zoneStroke, strokeWidth: 2 / zoom },
		clearance: clearance ? { name: 'asset-clearance', points: flat(clearance), closed: true, stroke: tokens.zoneCaption, strokeWidth: 1 / zoom, dash: [6 / zoom, 4 / zoom] } : null,
		label: { x: anchor.x, y: Math.min(...footprint.map(point => point.y)) - 18 / zoom, text: element.name, fontSize: 12 / zoom, fill: tokens.zoneLabel, listening: false },
	};
}
