import { createEntityId } from '../../core/identity/generateId';
import type { EntityId } from '../../core/identity/EntityId';

export type AssetId = EntityId<'asset'>;

export function createAssetId(): AssetId {
	return createEntityId('asset');
}
