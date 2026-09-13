import type { PlanPattern } from '../../../domain/asset/PlanPattern';
import type { Renovation, RenovationSubject } from '../../../domain/renovation/Renovation';

function shownAsset(subject: RenovationSubject, planned: boolean): string | undefined {
	if (!planned || !subject.planned) return subject.existing?.assetId;
	if (subject.planned.change === 'remove') return undefined;
	return subject.planned.change === 'unchanged' ? subject.existing?.assetId : subject.planned.assetId;
}

/** The plan pattern each wall shows: its planned material in the Planned mode, its existing one elsewhere (spec §6.7). */
export function wallPatterns(renovation: Renovation, catalogue: readonly { readonly asset: { readonly id: string; readonly planPattern: PlanPattern | null } }[], planned: boolean): ReadonlyMap<string, PlanPattern> {
	const patterns = new Map(catalogue.flatMap(({ asset }) => asset.planPattern ? [[asset.id, asset.planPattern] as const] : []));
	const result = new Map<string, PlanPattern>();
	for (const subject of renovation.subjects) {
		const assetId = subject.kind === 'wall' ? shownAsset(subject, planned) : undefined;
		const pattern = assetId ? patterns.get(assetId) : undefined;
		if (pattern) result.set(subject.targetId, pattern);
	}
	return result;
}
