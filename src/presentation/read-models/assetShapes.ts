import type { Result } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetShape, Dimensions } from '../../domain/asset/AssetShape';
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';
import type { Query } from '../../application/queries/Query';

/**
 * What placing an asset needs to know about it, settled PER ASSET: one unreadable sidecar makes
 * one placement a placeholder and leaves the rest of the floor drawn.
 */
export type AssetShapeAnswer =
	| { readonly kind: 'placeable'; readonly name: string; readonly shape: AssetShape; readonly dimensions: Dimensions }
	| { readonly kind: 'no-shape' | 'unscaled'; readonly name: string }
	| { readonly kind: 'missing' | 'unreadable' };

export function assetShapeAnswer(found: Result<AssetDesignDto, AssetDesignError>): AssetShapeAnswer {
	if (!found.ok) return { kind: found.error.code === 'asset.not-found' ? 'missing' : 'unreadable' };
	const { name, shape, dimensions } = found.value;
	if (shape === null || dimensions === null) return { kind: 'no-shape', name };
	if (shape.footprintPending) return { kind: 'unscaled', name };
	return { kind: 'placeable', name, shape, dimensions };
}

export async function readAssetShapes(get: Query<AssetId, Result<AssetDesignDto, AssetDesignError>>, ids: readonly string[]): Promise<ReadonlyMap<string, AssetShapeAnswer>> {
	const unique = [...new Set(ids)];
	return new Map(await Promise.all(unique.map(async id => [id, assetShapeAnswer(await get.execute(id as AssetId))] as const)));
}
