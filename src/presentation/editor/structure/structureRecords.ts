import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import { openingPoints, type Structure } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';
export function structureRecords(structure: Structure, planId: string): SpatialRecordDto[] {
	return [
		...structure.walls.map((wall, index) => ({ kind: 'wall' as const, id: wall.id, planId, name: tr('editor.structure.wall-number', { n: String(index + 1) }), zoneType: 'Wall', points: [wall.start, wall.end], areaMm2: 0 })),
		...structure.openings.map(opening => ({ kind: 'opening' as const, id: opening.id, planId, name: tr(`editor.add.${opening.kind}.label`), zoneType: 'Opening', points: openingPoints(opening, structure.walls), areaMm2: 0 })),
	];
}
