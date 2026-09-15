import type { PlanGeometryDTO } from '../../persistence/dto/planGeometry';
import { asymmetricWall, wallSideExtents } from '../../../domain/spatial/wallSides';

/** Centred extents are losslessly derivable by old readers; asymmetric ones require the refusing v13 boundary. */
export function hasIndependentWallSides(dto: Pick<PlanGeometryDTO, 'structure' | 'intended'>): boolean {
	return [dto.structure, dto.intended].some(structure => structure?.walls.some(asymmetricWall));
}

/** Every writer, including a legacy-shaped new wall, serializes complete face data. Invalid explicit pairs remain invalid. */
const complete = (structure: NonNullable<PlanGeometryDTO['structure']>) => ({ ...structure,
	walls: structure.walls.map(wall => wall.sideExtents === undefined ? { ...wall, sideExtents: wallSideExtents(wall) } : wall) });
export function withWallSideDefaults(dto: PlanGeometryDTO): PlanGeometryDTO {
	return { ...dto, ...(dto.structure ? { structure: complete(dto.structure) } : {}), ...(dto.intended ? { intended: complete(dto.intended) } : {}) };
}
