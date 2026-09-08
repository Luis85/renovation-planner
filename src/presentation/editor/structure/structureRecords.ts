import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import { openingPoints, type Structure } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';
import { area } from '../../../core/geometry/operations';
import type { SpatialElementMetadata } from '../../../domain/spatial/SpatialElement';
export function structureRecords(structure: Structure, planId: string, metadata: readonly SpatialElementMetadata[] = []): SpatialRecordDto[] {
	const names = new Map(metadata.map(item => [item.id, item.name]));
	return [
		...(structure.elements ?? []).map(element => {
			const measured = element.kind === 'object' ? area({ points: element.points }) : null;
			return { ...element, name: names.get(element.id) ?? element.id, planId, zoneType: element.kind, areaMm2: measured?.ok ? measured.value : 0 };
		}),
		...structure.walls.map((wall, index) => ({ kind: 'wall' as const, id: wall.id, planId, name: tr('editor.structure.wall-number', { n: String(index + 1) }), zoneType: 'Wall', points: [wall.start, wall.end], areaMm2: 0 })),
		...structure.openings.map(opening => ({ kind: 'opening' as const, id: opening.id, planId, name: tr(`editor.add.${opening.kind}.label`), zoneType: 'Opening', points: openingPoints(opening, structure.walls), areaMm2: 0 })),
	];
}
