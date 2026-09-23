<!--
	One tile of the Asset library's Grid view (AD18-R18, board 01's right-hand column): the asset's
	own footprint mark at tile size, its name and its measured size.

	`AssetRow.vue`'s twin in every rule that is about the ASSET rather than about the row's slots:
	- the same flattened `<button>`, carrying `data-asset-id` so §6.2's Back-to-library handoff and
	  §3.5's post-deletion focus find a tile exactly as they find a row;
	- selection as `aria-current` plus a printed ring, never a tint alone (§3.3);
	- §3.4's mark words in a span OUTSIDE the button, referenced by `aria-describedby` and minted
	  from the ordinal rather than the asset id, for the reasons `AssetRow.vue` records.

	The visible size is `aria-hidden` because the description already says it, with its state word
	in front, and a screen reader would otherwise hear the figures twice.
-->
<script setup lang="ts">
import { computed, useId } from 'vue';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import AssetMark from './AssetMark.vue';
import { sizeText, spokenMark } from './markWords';

const props = defineProps<{
	entry: CatalogueEntryDto;
	/** `null` for §3.4's *not yet read* — a tile never waits for its own mark. */
	outline: AssetOutline | null;
	selected: boolean;
	/** This tile's position in the grid — what the description span is minted from. */
	ordinal: number;
}>();

const emit = defineEmits<{ select: [assetId: AssetId] }>();

const baseId = useId();
const descriptionId = computed((): string => `${baseId}-mark-${String(props.ordinal)}`);
</script>

<template>
	<li class="rp-al-tiles__item">
		<button
			type="button"
			class="rp-al-tile"
			:class="{ 'rp-al-tile--on': selected }"
			:data-asset-id="entry.assetId"
			:aria-current="selected ? 'true' : undefined"
			:aria-describedby="descriptionId"
			@click="emit('select', entry.assetId)"
		>
			<AssetMark :outline="outline" />
			<span class="rp-al-tile__name">{{ entry.name }}</span>
			<span
				class="rp-al-tile__size"
				aria-hidden="true"
			>{{ sizeText(outline) }}</span>
		</button>
		<span
			:id="descriptionId"
			class="rp-al-row__mark-words"
		>{{ spokenMark(outline) }}</span>
	</li>
</template>
