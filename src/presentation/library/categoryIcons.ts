/**
 * The `AssetCategory` → icon lookup, ONE table for its two readers (AD18-R21 fix round 1):
 * the category sidebar (`AssetCategoryNav.vue`) and the Grid tile's design-less placeholder
 * (`AssetTile.vue`). Moved out of `AssetCategoryNav.vue`, unchanged, so the two can never draw a
 * different icon for the same category — a `const` inside a `<script setup>` SFC has no `export`
 * form, which is why this is a plain module rather than a re-exported binding.
 *
 * A category the build does not declare (a vault-authored one `shelfList.ts` still lists) takes
 * the `tag` icon, which is also why `categoryIcon` exists rather than every caller repeating
 * `?? 'tag'` at its own call site.
 */
import type { IconName } from 'obsidian';
import type { AssetCategory } from '../../domain/asset/AssetCategory';

const CATEGORY_ICONS: ReadonlyMap<string, IconName> = new Map<AssetCategory, IconName>([
	['material', 'layers'],
	['furniture', 'armchair'],
	['fixture', 'bath'],
	['plant', 'sprout'],
	['equipment', 'hammer'],
	['building-element', 'brick-wall'],
	['custom', 'pencil'],
]);

/** A category's icon, or `tag` for one the build does not declare. */
export function categoryIcon(category: string): IconName {
	return CATEGORY_ICONS.get(category) ?? 'tag';
}
