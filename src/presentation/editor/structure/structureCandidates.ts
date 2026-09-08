import { openingPoints, type Structure } from '../../../domain/spatial/Structure';
import type { SpatialObjectCandidate } from '../tools/select-tool';
export function structureCandidates(structure: Structure): SpatialObjectCandidate[] {
	return [
		...structure.walls.map(wall => ({ id: wall.id, kind: 'wall' as const, points: [wall.start, wall.end], width: wall.thickness })),
		...structure.openings.map(opening => ({ id: opening.id, kind: 'opening' as const, points: openingPoints(opening, structure.walls) })),
	];
}
