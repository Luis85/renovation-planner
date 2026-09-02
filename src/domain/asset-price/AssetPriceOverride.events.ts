import type { DomainEvent } from '../../core/events/EventBus';
import type { ProjectId } from '../project/ProjectId';
import type { AssetId } from '../asset/AssetId';

/**
 * BOTH ids, and the pair is the point. `AssetUpdated` carries the asset alone because a
 * shared default moved for every project; a price override moved for exactly ONE, and the
 * cascade this drives is narrowed by that project. A payload carrying only the asset would
 * make the narrowing unexpressible and the cascade would touch every project on the asset.
 *
 * ONE event for set, replace and clear alike: every subscriber's question is "this project's
 * price for this asset may have moved", and three events would be three subscriptions
 * answering it identically.
 */
export interface AssetPriceOverrideEventPayload {
	readonly projectId: ProjectId;
	readonly assetId: AssetId;
}

export interface AssetPriceOverrideChanged extends DomainEvent<'AssetPriceOverrideChanged'> {
	readonly payload: AssetPriceOverrideEventPayload;
}

export function assetPriceOverrideChanged(
	payload: AssetPriceOverrideEventPayload,
): AssetPriceOverrideChanged {
	return { type: 'AssetPriceOverrideChanged', payload };
}
