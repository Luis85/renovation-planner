import { openingPoints, wallLength, type Structure } from '../../../domain/spatial/Structure';
import { derivedFootprintKind, type SpatialElement } from '../../../domain/spatial/SpatialElement';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import { elementFootprint, NO_SHAPES, type ShapeLookup } from '../elements/elementFootprint';
import { draftingHitPoints, type DraftingHitContext } from '../elements/draftingMarks';

/** A derived footprint, or a drafting mark's screen-size box when the caller knows the zoom it is drawn at. */
function hitPointsOf(element: SpatialElement, shapeOf: ShapeLookup, marks: DraftingHitContext | undefined) {
	if (derivedFootprintKind(element.kind)) return elementFootprint(element, shapeOf);
	return marks ? draftingHitPoints(element, marks) : undefined;
}
export function structureCandidates(structure: Structure, shapeOf: ShapeLookup = NO_SHAPES, marks?: DraftingHitContext): SpatialObjectCandidate[] {
	return [
		...(structure.elements ?? []).map(element => { const hitPoints = hitPointsOf(element, shapeOf, marks); return { ...element, ...(hitPoints ? { hitPoints } : {}) }; }),
		...structure.walls.map(wall => ({ id: wall.id, kind: 'wall' as const, points: [wall.start, wall.end], bulges: [wall.bulge ?? 0, 0], width: wall.thickness })),
		...structure.openings.map(opening => {
			const host = structure.walls.find(wall => wall.id === opening.hostId);
			const bulge = host ? Math.tan(Math.atan(host.bulge ?? 0) * opening.width / wallLength(host)) : 0;
			return { id: opening.id, kind: 'opening' as const, points: openingPoints(opening, structure.walls), bulges: [bulge, 0], width: host?.thickness };
		}),
	];
}
