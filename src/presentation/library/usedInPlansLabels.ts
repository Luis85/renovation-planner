import type { PlanAssetUsage } from '../../application/queries/ListPlansUsingAsset';
import { tr } from '../i18n/strings';

/**
 * The two counted sentences of the plan-usage scope, their `.one`/`.other` key chosen HERE rather
 * than by `t`, which has no plural mechanism (AD18-R42, amending AD18-R7). Shared by the library's
 * `AssetUsageScope` and the designer's `DesignerUsageScope`/`DesignerUsagePlans`, so the two surfaces
 * cannot choose differently for one count.
 */
export function planUsageLabel(plan: PlanAssetUsage): string {
	const at = { name: plan.planName, project: plan.projectName };
	return plan.placements === 1
		? tr('view.asset-library.used-in-plans.plan.one', at)
		: tr('view.asset-library.used-in-plans.plan.other', { ...at, count: String(plan.placements) });
}

/** The incomplete-scope sentence for `count` unreadable notes. */
export function unreadableNotesLabel(count: number): string {
	return count === 1
		? tr('view.asset-library.used-in-plans.unreadable.one')
		: tr('view.asset-library.used-in-plans.unreadable.other', { count: String(count) });
}
