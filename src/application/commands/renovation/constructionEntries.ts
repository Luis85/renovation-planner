import { createRequirementId } from '../../../domain/requirement/RequirementId';
import { originRoomId } from '../../../domain/requirement/RequirementOrigin';
import { constructionRule } from '../../../domain/requirement/constructionRule';
import type { Renovation, RenovationSubject } from '../../../domain/renovation/Renovation';
import type { MaterialInput, PlanningBaseline } from './materialPlanning';

export type ConstructionStep = { readonly kind: 'save'; readonly input: MaterialInput } | { readonly kind: 'delete'; readonly id: string; readonly assetId: string };

/** The planned material that produces an entry: a new target, or a material that differs from the existing one (spec §6.5). */
export function constructionAsset(subject: RenovationSubject): string | undefined {
	const planned = subject.planned;
	if (!planned?.assetId) return undefined;
	if (planned.change === 'add') return planned.assetId;
	return planned.change === 'modify' && planned.assetId !== subject.existing?.assetId ? planned.assetId : undefined;
}

function wanted(subject: RenovationSubject | undefined, baseline: PlanningBaseline): Omit<MaterialInput, 'id' | 'override'> | null {
	const assetId = subject && constructionAsset(subject);
	const asset = baseline.catalogue.find(item => item.asset.id === assetId)?.asset;
	const target = subject?.kind === 'wall' ? 'wall' : subject?.kind === 'door' || subject?.kind === 'window' ? 'opening' : null;
	const rule = asset && target ? constructionRule(target, asset.unit) : null;
	if (!subject || !asset || !rule) return null;
	return { ...(subject.roomId ? { roomId: subject.roomId } : {}), assetId: asset.id, waste: asset.wasteFactorDefault.toString(),
		source: { planId: baseline.plan.entity.id, targetId: subject.targetId, workId: '', outcomeId: subject.id, state: 'intended', rule, manual: '0', coverage: '1', lot: '', minimum: '', construction: true } };
}

/** A planned asset the catalogue cannot find — an unreadable or deleted note — leaves its entry as it stands (spec §6.1). */
function unknownAsset(subject: RenovationSubject | undefined, baseline: PlanningBaseline): boolean {
	const assetId = subject && constructionAsset(subject);
	return !!assetId && !baseline.catalogue.some(item => item.asset.id === assetId);
}

/** The entry writes that make the saved construction entries match `proposed`'s subjects; deletions first. */
export function constructionSteps(baseline: PlanningBaseline, proposed: Renovation): readonly ConstructionStep[] {
	const entries = new Map(baseline.materials.filter(item => item.entity.source?.construction).map(item => [item.entity.source?.outcomeId ?? '', item.entity]));
	const subjects = new Map(proposed.subjects.map(item => [item.id, item]));
	const deletes = [...entries].filter(([subjectId]) => !wanted(subjects.get(subjectId), baseline) && !unknownAsset(subjects.get(subjectId), baseline)).map(([, entry]): ConstructionStep => ({ kind: 'delete', id: entry.id, assetId: entry.assetId }));
	// A repointed entry's save runs after the renovation write; that is safe only because a subject's room cannot change through the form today.
	const saves = proposed.subjects.flatMap((subject): ConstructionStep[] => {
		const input = wanted(subject, baseline), entry = entries.get(subject.id);
		if (!input) return [];
		const same = entry && entry.assetId === input.assetId && originRoomId(entry.origin) === input.roomId && entry.source?.rule === input.source.rule && entry.source.targetId === input.source.targetId;
		if (same) return [];
		const keep = entry && entry.unit === baseline.catalogue.find(item => item.asset.id === input.assetId)?.asset.unit;
		return [{ kind: 'save', input: { ...input, id: entry?.id ?? createRequirementId(), override: keep ? entry.quantity.override?.value.toString() ?? '' : '' } }];
	});
	return [...deletes, ...saves];
}
