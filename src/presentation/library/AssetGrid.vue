<!--
	The Asset library's Grid view (AD18-R18): one tile per asset, beside the unchanged List.

	**The scroll box keeps the class `.rp-al-shelves`**, so everything that asks about "the shelves
	region" asks about this box too, whichever layout draws: §7's narrow composition and
	`shelvesWithdrawn`'s focus handoff, the Back-to-library scroll restore in
	`AssetLibraryBody.shelvesElement`, and the region's own scroll and container rules.

	**The keyboard is `shelfFocus.ts`'s one manager, in two dimensions** (the brief refuses a second
	focus model): `←`/`→` step one stop with `moveFocus`, `↑`/`↓` one row with `moveFocusByRow`,
	both bound once on the grid.

	**The `Create your own` card ends the list** (board 01) and calls the existing `New asset` door
	through the same `create` emit §4's empty state uses, so there is still one door. It spans the
	full row, and it is the last arrow-key stop, which `moveFocusByRow`'s clamp makes reachable
	from any column.

	The tiles come in the order `AssetLibraryStore.visibleEntries` gives, which is by name across
	categories, §6.1's order for a flat list. §10 refuses a sort control, so there is no other order.
-->
<script setup lang="ts">
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import { moveFocus, moveFocusByRow } from './shelfFocus';
import AssetTile from './AssetTile.vue';
import HostIcon from '../components/HostIcon.vue';
import { tr } from '../i18n/strings';

defineProps<{
	entries: readonly CatalogueEntryDto[];
	selectedId: AssetId | null;
	outlineFor: (assetId: AssetId) => AssetOutline | null;
}>();

const emit = defineEmits<{ select: [assetId: AssetId]; create: [] }>();
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
			<li class="rp-al-create-card">
				<HostIcon name="pencil" />
				<div class="rp-al-create-card__body">
					<p class="rp-al-create-card__title">
						{{ tr('view.asset-library.create-card.title') }}
					</p>
					<p class="rp-al-create-card__hint">
						{{ tr('view.asset-library.create-card.hint') }}
					</p>
					<button
						type="button"
						class="rp-al-create-card__action"
						@click="emit('create')"
					>
						<HostIcon name="plus" />
						{{ tr('view.asset-library.new-asset') }}
					</button>
				</div>
			</li>
		</ul>
	</div>
</template>
