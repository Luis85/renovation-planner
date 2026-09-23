<!--
	The Asset library's Grid view (AD18-R18): one tile per asset, beside the unchanged List.

	**The scroll box keeps the class `.rp-al-shelves`**, so everything that asks about "the shelves
	region" asks about this box too, whichever layout draws: §7's narrow composition and
	`shelvesWithdrawn`'s focus handoff, the Back-to-library scroll restore in
	`AssetLibraryBody.shelvesElement`, and the region's own scroll and container rules.

	**The keyboard is `shelfFocus.ts`'s one manager, in two dimensions** (the brief refuses a second
	focus model): `←`/`→` step one stop with `moveFocus`, `↑`/`↓` one row with `moveFocusByRow`,
	both bound once on the grid.

	The tiles come in the order `AssetLibraryStore.visibleEntries` gives, which is by name across
	categories, §6.1's order for a flat list. §10 refuses a sort control, so there is no other order.
-->
<script setup lang="ts">
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import { moveFocus, moveFocusByRow } from './shelfFocus';
import AssetTile from './AssetTile.vue';

defineProps<{
	entries: readonly CatalogueEntryDto[];
	selectedId: AssetId | null;
	outlineFor: (assetId: AssetId) => AssetOutline | null;
}>();

const emit = defineEmits<{ select: [assetId: AssetId] }>();
</script>

<template>
	<div class="rp-al-shelves">
		<ul
			class="rp-al-tiles"
			@keydown.left="moveFocus($event, -1)"
			@keydown.right="moveFocus($event, 1)"
			@keydown.up="moveFocusByRow($event, -1)"
			@keydown.down="moveFocusByRow($event, 1)"
		>
			<AssetTile
				v-for="(entry, ordinal) in entries"
				:key="entry.assetId"
				:entry="entry"
				:outline="outlineFor(entry.assetId)"
				:selected="entry.assetId === selectedId"
				:ordinal="ordinal"
				@select="emit('select', $event)"
			/>
		</ul>
	</div>
</template>
