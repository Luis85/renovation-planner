<!--
	One row of the Asset library's shelves (design "Asset library overview" §3.3): the asset's
	own footprint mark, its name, its unit cost, its waste factor and its supplier.

	Ported from the row markup inside `src/prototypes/AssetShelf.vue`'s `<template>`. What
	changed from the prototype and why:
	- Promoted to its own component: the prototype rendered every row inline in one `v-for`
	  inside the shelf; this task's own test mounts a row in isolation, which inline markup
	  could never support, and `AssetShelf.vue` composes one instance of this per entry.
	- Reads Task 5's real `CatalogueEntryDto` and Task 6's `AssetOutline` rather than the
	  prototype's own invented `CatalogueAsset` fixture. `showCategory` and the sixth grid
	  column it drove are dropped along with it: §3.3's own row table is five slots wide and
	  none of them is a category, and the flattened search-result list that needs a sixth
	  column belongs to whichever task builds §6.1.
	- The unit price prints through `Intl.NumberFormat`, keyed on `entry.currency`, rather than
	  the prototype's own two-entry symbol table (`src/prototypes/assetPrice.ts`) — that
	  module's own docblock names this as the intended promotion: "a promoted component
	  resolves this through the locale rather than through a table this size." Fraction digits
	  are pinned at 2 regardless of what a currency's own ICU convention would print, because
	  `Money.round` finalizes every stored amount at two decimal places (ADR-010) — a
	  zero-decimal currency such as JPY must still show the figure as it is stored, not rounded
	  to whatever that currency ordinarily displays.
-->
<script setup lang="ts">
import { computed, useId } from 'vue';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Dimensions } from '../../domain/asset/AssetShape';
import { currentLanguage, tr } from '../i18n/strings';
import AssetMark from './AssetMark.vue';

const props = defineProps<{
	entry: CatalogueEntryDto;
	/** `null` for §3.4's *not yet read* — a row must never wait for its own mark. */
	outline: AssetOutline | null;
	selected: boolean;
	/** This row's position within its shelf — what the description span below is minted from. */
	ordinal: number;
}>();

const emit = defineEmits<{ select: [assetId: AssetId] }>();

/**
 * Minted from `ordinal`, never from `entry.assetId` (§3.4). `AssetFrontmatterSchemaV1`
 * validates an id with `z.string().min(1)` alone, so a hand-authored one may hold whitespace
 * — and `aria-describedby` is a whitespace-separated IDREF LIST, so an id spelled `wall tile`
 * would become two references resolving to nothing, and the row would lose its description
 * silently. `useId()` alone already gives this row instance a page-unique base (it is a
 * separate component instance per row); the ordinal rides along as the stated, human-checkable
 * reason the resulting id need never collide with a sibling row's, exactly as the prototype's
 * own `AssetShelf.vue` combined one shelf-wide `useId()` with each row's loop index.
 */
const baseId = useId();
const descriptionId = computed((): string => `${baseId}-mark-${String(props.ordinal)}`);

function dimensionsText(extent: Dimensions, withUnit: boolean): string {
	// Raw, unrounded, matching `DesignerInspector.vue`'s own established convention for this
	// exact value (`{{ dimensions.width }} × {{ dimensions.depth }} mm`) rather than the
	// prototype's more elaborate float-noise rounding — one house convention for one fact.
	return `${String(extent.width)} × ${String(extent.depth)}${withUnit ? ' mm' : ''}`;
}

/**
 * The mark's state AND extent in words (§3.4 — "every", with no carve-out for `measured`),
 * referenced by the row through `aria-describedby` rather than nested inside it — a text
 * descendant of the button would join its accessible name ahead of the asset's own, and the
 * row's name would become a sentence. Every one of the five states has its own word now,
 * following the spec's own worked example verbatim ("Measured footprint, 1200 × 190 mm") —
 * an earlier version of this file withheld `measured`'s word on the reasoning that its extent
 * alone was what the other four are stated against, which is a real argument and not this
 * specification's: a browsing screen-reader user hears the figure and would have had to infer
 * "measured" from the ABSENCE of a word, the identical failure carried in pixels §3.4 exists
 * to refuse in words instead. `unscaled` still withholds its UNIT (never its word) exactly as
 * the definition panel's own dimensions warning does, so nothing recites a placeholder number
 * as a measurement.
 */
const spokenMark = computed((): string => {
	const outline = props.outline;
	if (outline === null) return tr('view.asset-library.shape.pending');
	if (outline.kind === 'measured') {
		return `${tr('view.asset-library.shape.measured')}, ${dimensionsText(outline.extent, true)}`;
	}
	if (outline.kind === 'unscaled') {
		return `${tr('view.asset-library.shape.unscaled')}, ${dimensionsText(outline.extent, false)}`;
	}
	if (outline.kind === 'none') return tr('view.asset-library.shape.none');
	return tr('view.asset-library.shape.unreadable');
});

/**
 * The currency comes from the entry, never from a literal — the prototype shipped a
 * hard-coded euro sign, which reported the wrong currency for any non-EUR asset. An asset
 * carries its own currency and a project carries its own (PRD §72), so a vault-wide catalogue
 * is legitimately mixed.
 */
const priceLabel = computed((): string =>
	new Intl.NumberFormat(currentLanguage(), {
		style: 'currency',
		currency: props.entry.currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(Number(props.entry.unitCostAmount)));

/**
 * Fraction in [0, 1] (`Requirement.ts`'s own comment on the field this defaults) to a printed
 * percentage, or `null` where the default is zero and the slot draws nothing (§3.3). Rounded
 * to three decimals first — this repository's own figure for telling a real value from float
 * noise — so `0.08 * 100` cannot print as `8.000000000000002`.
 */
const wasteLabel = computed((): string | null => {
	const fraction = Number(props.entry.wasteFactorDefault);
	if (fraction === 0) return null;
	const percent = Number((fraction * 100).toFixed(3));
	return `+${String(percent)}%`;
});
</script>

<template>
	<li class="rp-al-rows__item">
		<button
			type="button"
			class="rp-al-row"
			:class="{ 'rp-al-row--on': selected }"
			:data-asset-id="entry.assetId"
			:aria-current="selected ? 'true' : undefined"
			:aria-describedby="descriptionId"
			@click="emit('select', entry.assetId)"
		>
			<AssetMark :outline="outline" />
			<span class="rp-al-row__name">{{ entry.name }}</span>
			<span class="rp-al-row__cost">
				<span class="rp-al-row__amount">{{ priceLabel }}</span>
				<span class="rp-al-row__unit"> / {{ entry.unit }}</span>
			</span>
			<span class="rp-al-row__waste">{{ wasteLabel ?? '' }}</span>
			<span class="rp-al-row__supplier">{{ entry.supplier ?? '' }}</span>
		</button>
		<span
			:id="descriptionId"
			class="rp-al-row__mark-words"
		>{{ spokenMark }}</span>
	</li>
</template>
