import { guardMaterialGeometry } from './planningReferentialGuard';
import { parseYaml, TFile, type Vault } from 'obsidian';
import { err, ok, type Result } from '../../../core/result/Result';
import type { PersistenceError, ValidationError } from '../../../core/errors/AppError';
import type { PlanId } from '../../../domain/plan/PlanId';
import type { ProjectIndex } from '../../../application/ports/ProjectIndex';
import { RenovationSchema } from '../../persistence/dto/renovation';
import type { PlanGeometryDTO } from '../../persistence/dto/planGeometry';
import { validateRenovationTargets } from '../../../domain/renovation/renovationTargets';
import { renovationError } from '../../../domain/renovation/Renovation';
import { persistenceError } from './noteIo';

const ids = (dto: PlanGeometryDTO): string[] => [...dto.objects.map(item => item.id), ...dto.structure?.walls.map(item => item.id) ?? [], ...dto.structure?.openings.map(item => item.id) ?? [], ...dto.structure?.elements?.map(item => item.id) ?? []];

/** Read actual bytes before a spatial deletion; a metadata-cache lag cannot waive links. */
export async function guardRenovationGeometry(deps: { vault: Vault; index: ProjectIndex }, planId: PlanId, before: PlanGeometryDTO, after: PlanGeometryDTO): Promise<Result<void, PersistenceError | ValidationError>> {

	const materials = await guardMaterialGeometry(deps, planId, before, after);
	if (!materials.ok) return materials;
	const surviving = new Set(ids(after));
	// Geometry modifications retain IDs; the same-state host validator owns their validity.
	if (ids(before).every(id => surviving.has(id))) return ok(undefined);
	const path = deps.index.getPath(planId);
	const file = path ? deps.vault.getAbstractFileByPath(path) : null;
	if (!(file instanceof TFile)) return err(renovationError('room-missing'));
	try {
		const text = await deps.vault.read(file);
		const yaml = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1];
		const raw: unknown = yaml ? parseYaml(yaml) : null;
		if (typeof raw !== 'object' || raw === null || !('renovation' in raw)) return ok(undefined);
		const parsed = RenovationSchema.safeParse(raw.renovation);
		if (!parsed.success) return err(renovationError('state'));
		return validateRenovationTargets(parsed.data, { ...after, roomIds: after.objects.map(item => item.id) });
	} catch (cause) { return err(persistenceError('renovation.read-failed', 'Could not inspect renovation links.', cause)); }
}
