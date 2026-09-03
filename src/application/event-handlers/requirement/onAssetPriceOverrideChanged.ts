import { isErr } from '../../../core/result/Result';
import type { EventBus } from '../../../core/events/EventBus';
import type { Disposable } from '../../../core/events/Disposable';
import type { AssetPriceOverrideChanged } from '../../../domain/asset-price/AssetPriceOverride.events';
import type { CascadeDeps } from './cascade';
import { runRecalculationCascade } from './cascade';

/**
 * A project's own price for a shared Asset moved, so every Requirement IN THAT PROJECT
 * referencing that Asset was derived from a figure that no longer holds.
 *
 * **The narrowing is the whole difference from `onAssetUpdated`**, and it is worth stating:
 * an `AssetUpdated` cascade touches every project, because the shared default changed for all
 * of them. A price override changed touches one. `listByAsset` is still the read — a
 * `listByProjectAndAsset` would be a third list method for a filter one line long — and the
 * project filter is applied here.
 *
 * A subscriber, not a mechanism: it reuses `runRecalculationCascade` unchanged.
 *
 * It performs NO skip test. `onAssetUpdated` has one because a rename or an unrelated field
 * edit fans out over every requirement on the asset and mostly changes nothing; here the event
 * fires only when a price really moved (the commands do not announce a no-op clear), and every
 * requirement it reaches was derived from exactly that number.
 */
export function registerOnAssetPriceOverrideChanged(events: EventBus, deps: CascadeDeps): Disposable {
	return events.subscribe('AssetPriceOverrideChanged', async (event) => {
		const { projectId, assetId } = (event as AssetPriceOverrideChanged).payload;
		const listed = await deps.requirements.listByAsset(assetId);
		if (isErr(listed)) {
			deps.logger.error('requirement.list-by-asset.failed', { assetId, cause: listed.error });
			deps.notify?.cascadeAborted(assetId);
			return;
		}
		const inProject = listed.value.filter((r) => r.entity.projectId === projectId);
		if (inProject.length === 0) return;
		await runRecalculationCascade(deps, inProject);
	});
}
