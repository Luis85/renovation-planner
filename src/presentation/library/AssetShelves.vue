<script setup lang="ts">
import { computed } from 'vue';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetCategory } from '../../domain/asset/AssetCategory';
import { ASSET_CATEGORY_LABELS } from '../views/assetLabels';
import { currentLanguage, tr } from '../i18n/strings';
import { moveFocus } from './shelfFocus';
import AssetShelf from './AssetShelf.vue';

const props = withDefaults(
	defineProps<{
		entries: readonly CatalogueEntryDto[];
		searching: boolean;
		expanded: ReadonlySet<string>;
		selectedId?: AssetId | null;
		outlineFor: (assetId: AssetId) => AssetOutline | null;
	}>(),
	{ selectedId: null },
);

const emit = defineEmits<{ toggle: [category: string]; select: [assetId: AssetId] }>();

interface Shelf {
	readonly category: string;
	readonly label: string;
	readonly entries: readonly CatalogueEntryDto[];
}

const DECLARED: readonly AssetCategory[] = Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[];

const shelves = computed((): readonly Shelf[] => {
	const declared = new Set<string>(DECLARED);
	const byCategory = new Map<string, CatalogueEntryDto[]>();
	for (const entry of props.entries) {
		const bucket = byCategory.get(entry.category);
		if (bucket === undefined) byCategory.set(entry.category, [entry]);
		else bucket.push(entry);
	}
	const collator = new Intl.Collator(currentLanguage());
	const undeclared = [...byCategory.keys()]
		.filter((category) => !declared.has(category))
		.toSorted(collator.compare);
	return [...DECLARED, ...undeclared].map((category) => ({
		category,
		label: declared.has(category)
			? tr(ASSET_CATEGORY_LABELS[category as AssetCategory])
			: category,
		entries: byCategory.get(category) ?? [],
	}));
});
</script>

<template>
	<div
		class="rp-al-shelves"
		@keydown.down="moveFocus($event, 1)"
		@keydown.up="moveFocus($event, -1)"
	>
		<div
			class="rp-al-columns"
			aria-hidden="true"
		>
			<span /><span>{{ tr('form.new-asset.name') }}</span><span>{{ tr('view.asset-library.unit-cost') }}</span><span>{{ tr('view.asset-library.waste') }}</span><span>{{ tr('view.asset-library.supplier') }}</span>
		</div>
		<template
			v-for="shelf in shelves"
			:key="shelf.category"
		>
			<AssetShelf
				v-if="!searching || shelf.entries.length > 0"
				:label="shelf.label"
				:entries="shelf.entries"
				:expanded="searching || expanded.has(shelf.category)"
				:collapsible="!searching"
				:selected-id="selectedId"
				:outline-for="outlineFor"
				@toggle="emit('toggle', shelf.category)"
				@select="emit('select', $event)"
			/>
		</template>
	</div>
</template>
