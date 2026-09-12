import { err, ok, type Result } from '../../../core/result/Result';
import type { AppError } from '../../../core/errors/AppError';
import type { Plan } from '../../../domain/plan/Plan';
import { EMPTY_RENOVATION, type Renovation, type RenovationSubject } from '../../../domain/renovation/Renovation';
import type { PlanGeometryDocument } from '../../ports/PlanGeometrySidecar';
import { referenceError } from '../../errors';
import { readPlanning, type PlanningDeps } from './materialPlanning';
import { validateDepthLinks } from './planningLinks';

const materialIds = (subject: RenovationSubject): string[] => [subject.existing?.assetId, subject.planned?.assetId].filter((id): id is string => !!id);

/** Only a material the proposal ADDS must exist: a note naming a since-deleted asset stays editable (spec §6.1). */
export function introducedUnknownMaterials(proposed: Renovation, current: Renovation, known: ReadonlySet<string>): readonly string[] {
	const before = new Set(current.subjects.flatMap(materialIds));
	return [...new Set(proposed.subjects.flatMap(materialIds))].filter(id => !known.has(id) && !before.has(id));
}

/** The renovation write's link check, against a fresh planning read of the same plan. */
export function renovationLinkCheck(deps: PlanningDeps) {
	return async (plan: Plan, document: PlanGeometryDocument): Promise<Result<void, AppError>> => {
		const fresh = await readPlanning(deps, plan.id);
		if (!fresh.ok) return fresh;
		const proposed = plan.renovation ?? EMPTY_RENOVATION;
		const unknown = introducedUnknownMaterials(proposed, fresh.value.plan.entity.renovation ?? EMPTY_RENOVATION, new Set(fresh.value.catalogue.map(item => item.asset.id as string)));
		if (unknown.length) return err(referenceError('renovation.material-missing', `No catalogue asset ${unknown.join(', ')}.`));
		const links = validateDepthLinks(proposed, { ...fresh.value, geometry: { ...fresh.value.geometry, document } });
		return links.ok ? ok(undefined) : links;
	};
}
