import { isErr } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Disposable } from '../../../core/events/Disposable';
import type { AssetRepository } from '../../ports/AssetRepository';
import type { AssetUpdated } from '../../../domain/asset/Asset.events';
import type { CascadeDeps } from './cascade';
import { runRecalculationCascade } from './cascade';
import { assetMatchesCalculatedFrom } from '../../commands/requirement/deriveRequirementFigures';

/** The asset lookup the skip-check needs, on top of the shared cascade collaborators. */
export interface AssetCascadeDeps extends CascadeDeps {
	readonly assets: AssetRepository;
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
		const listed = await deps.requirements.listByAsset(assetId);
		if (isErr(listed)) {
			deps.logger.error('requirement.list-by-asset.failed', {
				assetId,
				cause: listed.error,
			});
			deps.notify?.cascadeAborted(assetId);
			return;
		}
		if (listed.value.length === 0) return;

		const asset = await deps.assets.getById(assetId);
		if (isErr(asset) || asset.value === null) {
			// The asset vanished between the update and its own cascade; treat every link
			// as changed — recalculation will refuse against the missing endpoint and
			// leave each requirement visibly stale.
			deps.logger.error('requirement.cascade-asset-gone', { assetId });
			await runRecalculationCascade(deps, listed.value);
			return;
		}
		const current = asset.value.entity;

		const changed = listed.value.filter(
			(r) => !assetMatchesCalculatedFrom(r.entity.calculatedFrom, current),
		);
		await runRecalculationCascade(deps, changed);
	});
}
