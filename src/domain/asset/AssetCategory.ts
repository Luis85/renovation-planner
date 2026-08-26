/**
 * The closed vocabulary of catalog categories (PRD §8 "Asset", Epic 6). Same shape as
 * every other domain vocabulary: a union, the readonly array the persistence schema
 * validates against, and the guard.
 */
export type AssetCategory =
	| 'material'
	| 'furniture'
	| 'fixture'
	| 'plant'
	| 'equipment'
	| 'building-element'
	| 'custom';

export const ASSET_CATEGORIES: readonly AssetCategory[] = [
	'material',
	'furniture',
	'fixture',
	'plant',
	'equipment',
	'building-element',
	'custom',
];

export function isAssetCategory(value: unknown): value is AssetCategory {
	return typeof value === 'string' && (ASSET_CATEGORIES as readonly string[]).includes(value);
}
