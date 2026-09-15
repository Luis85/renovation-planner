import type { SpatialRecordDto } from '../../read-models/spatialRecords';
import { openingPoints, wallLength, type Structure } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';
import { area } from '../../../core/geometry/operations';
import type { SpatialElementMetadata } from '../../../domain/spatial/SpatialElement';
import { closedFootprintKind, derivedFootprintKind } from '../../../domain/spatial/SpatialElement';
import { elementFootprint, NO_SHAPES, type ShapeLookup } from '../elements/elementFootprint';
import { wallHitGeometry } from './wallHitGeometry';
export function structureRecords(structure: Structure, planId: string, metadata: readonly SpatialElementMetadata[] = [], shapeOf: ShapeLookup = NO_SHAPES): SpatialRecordDto[] {
	const names = new Map(metadata.map(item => [item.id, item.name]));
	const wallHits = wallHitGeometry(structure);
	return [
		...(structure.elements ?? []).map(element => {
			const footprint = elementFootprint(element, shapeOf), closed = closedFootprintKind(element.kind);
			const measured = closed ? area({ points: footprint }) : null;
			return { ...element, ...(derivedFootprintKind(element.kind) ? { hitPoints: footprint } : {}), name: names.get(element.id) ?? element.id, planId, zoneType: element.kind, areaMm2: measured?.ok ? measured.value : 0 };
		}),
		...structure.walls.map((wall, index) => ({ kind: 'wall' as const, id: wall.id, planId, name: tr('editor.structure.wall-number', { n: String(index + 1) }), zoneType: 'Wall', points: [wall.start, wall.end], bulges: [wall.bulge ?? 0, 0], areaMm2: 0, ...wallHits.get(wall.id) })),
		...structure.openings.map(opening => {
			const host = structure.walls.find(wall => wall.id === opening.hostId);
			return { kind: 'opening' as const, id: opening.id, planId, name: tr(`editor.add.${opening.kind}.label`), zoneType: 'Opening', points: openingPoints(opening, structure.walls), bulges: [host ? Math.tan(Math.atan(host.bulge ?? 0) * opening.width / wallLength(host)) : 0, 0], areaMm2: 0, ...wallHits.get(opening.id) };
		}),
	];
}
