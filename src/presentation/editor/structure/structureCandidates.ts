import { openingPoints, wallLength, type Structure } from '../../../domain/spatial/Structure';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import { elementFootprint, NO_SHAPES, type ShapeLookup } from '../elements/elementFootprint';
export function structureCandidates(structure: Structure, shapeOf: ShapeLookup = NO_SHAPES): SpatialObjectCandidate[] {
	return [
		...(structure.elements ?? []).map(element => ({ ...element, ...(element.kind === 'stair' || element.kind === 'asset' ? { hitPoints: elementFootprint(element, shapeOf) } : {}) })),
		...structure.walls.map(wall => ({ id: wall.id, kind: 'wall' as const, points: [wall.start, wall.end], bulges: [wall.bulge ?? 0, 0], width: wall.thickness })),
		...structure.openings.map(opening => {
			const host = structure.walls.find(wall => wall.id === opening.hostId);
			const bulge = host ? Math.tan(Math.atan(host.bulge ?? 0) * opening.width / wallLength(host)) : 0;
			return { id: opening.id, kind: 'opening' as const, points: openingPoints(opening, structure.walls), bulges: [bulge, 0], width: host?.thickness };
		}),
	];
}
