<script setup lang="ts">
import { computed } from 'vue';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import { tr } from '../i18n/strings';
import { shelvesOf, type Shelf } from './shelfList';
import { moveFocus } from './shelfFocus';
import AssetShelf from './AssetShelf.vue';

const props = withDefaults(
	defineProps<{
		entries: readonly CatalogueEntryDto[];
		searching: boolean;
		expanded: ReadonlySet<string>;
		selectedId?: AssetId | null;
		outlineFor: (assetId: AssetId) => AssetOutline | null;
		/** AD18-R18's sidebar filter: one category's shelf, or `''` for every shelf. */
		category?: string;
	}>(),
	{ selectedId: null, category: '' },
);

const emit = defineEmits<{ toggle: [category: string]; select: [assetId: AssetId] }>();

/**
 * §3.2's derived list (`shelfList.ts`, shared with the category sidebar), narrowed to the one
 * category AD18-R18's sidebar filters to, or all of them for `''`.
 */
const shelves = computed((): readonly Shelf[] =>
	shelvesOf(props.entries).filter((shelf) => props.category === '' || shelf.category === props.category),
);
</script>

<template>
	<div
		class="rp-al-shelves"
		@keydown.down="moveFocus($event, 1)"
		@keydown.up="moveFocus($event, -1)"
	>
		<!-- Read once as context for the rows below. Below 19rem the row and the waste cell are display:none together, and the supplier heading leaves with its own cell below 40rem, so nothing is announced that a sighted reader cannot see (§10). -->
		<div class="rp-al-columns">
			<span /><span>{{ tr('form.new-asset.name') }}</span><span class="rp-al-columns__cost">{{ tr('view.asset-library.unit-cost') }}</span><span>{{ tr('view.asset-library.waste') }}</span><span class="rp-al-columns__supplier">{{ tr('view.asset-library.supplier') }}</span>
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
