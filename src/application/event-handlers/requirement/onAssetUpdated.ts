import { isErr } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Disposable } from '../../../core/events/Disposable';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { AssetPriceOverrideRepository } from '../../ports/AssetPriceOverrideRepository';
import { winnersBy } from '../../ports/AssetPriceOverrideRepository';
import type { AssetUpdated } from '../../../domain/asset/Asset.events';
import type { Money } from '../../../core/money/Money';
import type { ProjectId } from '../../../domain/project/ProjectId';
import type { CascadeDeps } from './cascade';
import { requirementsOnAsset, runRecalculationCascade } from './cascade';
import { assetMatchesCalculatedFrom } from '../../commands/requirement/deriveRequirementFigures';
import { effectiveUnitCostFrom } from '../../commands/requirement/resolveEffectiveUnitCost';

/**
 * The asset lookup the skip-check needs, on top of the shared cascade collaborators, plus the
 * precedence's input half: a project may price a shared asset in its own currency, which is
 * what `calculatedFrom.unitCost` records under an override rather than the catalogue default.
 */
export interface AssetCascadeDeps extends CascadeDeps {
	readonly assets: AssetRepository;
	readonly overrides: AssetPriceOverrideRepository;
}

/**
 * The cascade's second half: a requirement's cost is a function of the zone's geometry
 * AND the asset's price, so `UpdateAssetCommand`'s event drives the same
 * markStale-then-recalculate sequence over `listByAsset`. It is a separate file rather
 * than a shared one because the two events carry different payloads; the sequence is
 * small enough that sharing it would cost more indirection than it saves.
 *
 * Per requirement, BEFORE markStale, the recorded inputs decide: if the updated asset
 * still matches what this requirement's figures were computed FROM (same price, same unit
 * symbol), the figures are still correct by construction and nothing is rewritten. A
 * rename of an asset eighty requirements reference becomes eighty comparisons and zero
 * writes. The lookup still runs — the saving is in the writes, which is where the cost is.
 */
export function registerOnAssetUpdated(events: EventBus, deps: AssetCascadeDeps): Disposable {
	return events.subscribe('AssetUpdated', async (event) => {
		const { assetId } = (event as AssetUpdated).payload;
		const listed = await requirementsOnAsset(deps, assetId);
		if (listed === null || listed.length === 0) return;

		const asset = await deps.assets.getById(assetId);
		// **Two causes, one fallback, two log lines.** The RECOVERY is the same either way and
		// deliberately so: treat every link as changed, because recalculation will refuse
		// against an endpoint it cannot establish and leave each requirement visibly stale.
		// What differs is what a developer is told. This was one branch logging
		// `cascade-asset-gone` for both, so a vault that could not be READ was reported as an
		// asset that had been deleted — and with no cause attached, which is the one arm in
		// this file that had nothing to map from. Slice 11's rule is that a mapped error is
		// logged with the original that produced it. Sibling of the same relabel in
		// `reversible-assign-asset-command.ts`, where the collapsed branch also escaped to a
		// caller and reached the save indicator; here it escapes to nobody, so the whole cost
		// was the diagnosis.
		if (isErr(asset)) {
			deps.logger.error('requirement.cascade-asset-unreadable', { assetId, cause: asset.error });
			await runRecalculationCascade(deps, listed);
			return;
		}
		if (asset.value === null) {
			deps.logger.error('requirement.cascade-asset-gone', { assetId });
			await runRecalculationCascade(deps, listed);
			return;
		}
		const current = asset.value.entity;

		// ONE read for the whole fan-out. `listByAsset` exists for this: a shared asset can be
		// referenced from every project in the vault, and resolving each requirement's override
		// separately would be a read per requirement — the cost Amendment 1 refused when it
		// declined to put a project read on this path.
		const overrides = await deps.overrides.listByAsset(assetId);
		if (isErr(overrides)) {
			deps.logger.error('requirement.cascade-overrides-unreadable', { assetId, cause: overrides.error });
			// Same recovery as an unreadable asset: treat every link as changed. Recalculation
			// refuses against an endpoint it cannot establish and leaves each requirement
			// visibly stale, which is the honest outcome for a read we could not perform.
			await runRecalculationCascade(deps, listed);
			return;
		}
		// `winnersBy`, NOT `new Map(list.map(...))`. That spelling keeps whichever note came last
		// in `listByAsset` order, while `getForPair` and the price list both answer the highest
		// id — so this skip test would compare against a different price than recalculation
		// resolves, and every overridden requirement in a duplicated-pair vault would
		// false-invalidate on enumeration order alone.
		const winners = winnersBy(overrides.value, (o) => o.entity.projectId, (projectId, notes) => {
			deps.logger.warn('asset-price.duplicate-pair', { projectId, assetId, count: notes.length });
		});
		const byProject = new Map<ProjectId, Money>(
			[...winners].map(([projectId, override]) => [projectId, override.entity.unitCost]),
		);

		const changed = listed.filter(
			(r) =>
				!assetMatchesCalculatedFrom(r.entity.calculatedFrom, {
					// The EFFECTIVE cost this requirement's figures were derived from — the
					// catalogue default only when its project has no price of its own.
					unitCost: effectiveUnitCostFrom(byProject, r.entity.projectId, current),
					unit: current.unit,
				}),
		);
		await runRecalculationCascade(deps, changed);
	});
}
