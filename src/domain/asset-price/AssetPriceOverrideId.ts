import { createEntityId } from '../../core/identity/generateId';
import type { EntityId } from '../../core/identity/EntityId';

export type AssetPriceOverrideId = EntityId<'assetprice'>;

export function createAssetPriceOverrideId(): AssetPriceOverrideId {
	return createEntityId('assetprice');
}
