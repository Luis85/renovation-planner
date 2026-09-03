<!--
	One category shelf of the Asset library (design "Asset library overview" §3.2): its header,
	its count, and its sorted rows.

	Ported from `src/prototypes/AssetShelf.vue`. What changed from the prototype and why:
	- Each row is an `AssetRow.vue` instance now, one per entry, rather than markup inlined in
	  this file's own `v-for` — Task 12's own row test mounts `AssetRow` in isolation, which
	  the prototype's inlined markup could never support, and every row mints its own
	  description id from its own `useId()` plus its ordinal rather than sharing one shelf-wide
	  id split by loop index the way the prototype did.
	- `entries` are Task 5's real `CatalogueEntryDto`s, and each row's mark comes from an
	  `outlineFor` lookup (Task 6's `AssetOutline`) rather than the prototype's own
	  `CatalogueAsset.outline` field — a catalogue entry carries no geometry of its own; §5.3's
	  viewport-batched read is what answers it, per visible row, and a shelf that is not on
	  screen must ask nothing. Neither `outlineFor` nor `selectedId` is named in this task's own
	  "Produces" line (`<AssetShelf :label :entries :expanded :collapsible @toggle @select>`),
	  and both are added here because the component cannot otherwise satisfy `AssetRow`'s own
	  required `outline`/`selected` props — see the task report for that judgment call. Both are
	  optional, defaulting to "nothing is selected" and "not yet read for every row", so the
	  literal contract's own call shape still mounts and draws correctly.
	- `showCategory` and the sixth grid column it drove are dropped: §3.3's own row table is
	  five slots wide and none of them is a category, and the flattened search-result list that
	  needs a sixth column is a different section (§6.1) than this one.
	- The shelf LIST itself (which categories exist, in which order, including the two rules
	  about an empty declared shelf and an unreachable undeclared one) is a property of WHICH
	  shelves exist, decided by whoever composes the library's whole set of shelves — this
	  component draws the one shelf it is handed. `collapsible` (never `entries.length`) is what
	  decides whether THIS shelf offers a disclosure control at all: a caller passing
	  `collapsible: false` for a non-empty list (§6.1's flattened Results heading) draws the
	  same plain, non-interactive heading a declared-but-empty shelf draws, and for the
	  identical reason recorded in the prototype's own header — a control that can never change
	  anything is the live-control-that-does-nothing this project's own empty-state amendment
	  refuses.
-->
<script setup lang="ts">
import { computed, useId } from 'vue';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import { currentLanguage } from '../i18n/strings';
import AssetRow from './AssetRow.vue';

const props = withDefaults(
	defineProps<{
		label: string;
		entries: readonly CatalogueEntryDto[];
		expanded?: boolean;
		selectedId?: string | null;
		/**
		 * §6.1's flattened Results heading passes `false` over a non-empty list — the plain
		 * heading it draws then is not the same fact as "this shelf has nothing in it", which
		 * is why this is asked BEFORE the empty check below rather than folded into it.
		 */
		collapsible: boolean;
		/** `null` for §3.4's *not yet read* — a shelf never waits for its own rows' marks. */
		outlineFor?: (assetId: AssetId) => AssetOutline | null;
	}>(),
	{ expanded: false, selectedId: null, outlineFor: undefined },
);

defineEmits<{ toggle: []; select: [assetId: AssetId] }>();

const listId = useId();

/** Locale-aware, under the resolved language (§3.2) — the vault's names, not the code's own. */
const sortedEntries = computed((): readonly CatalogueEntryDto[] => {
	const collator = new Intl.Collator(currentLanguage());
	return props.entries.toSorted((a, b) => collator.compare(a.name, b.name));
});

function outlineOf(assetId: AssetId): AssetOutline | null {
	return props.outlineFor?.(assetId) ?? null;
}
</script>

<template>
	<section class="rp-al-shelf">
		<h3
			v-if="entries.length === 0"
			class="rp-al-shelf__static rp-al-shelf__static--empty"
		>
			<span class="rp-al-shelf__name">{{ label }}</span>
			<span class="rp-al-shelf__count">0</span>
		</h3>
		<h3
			v-else-if="!collapsible"
			class="rp-al-shelf__static"
		>
			<span class="rp-al-shelf__name">{{ label }}</span>
			<span class="rp-al-shelf__count">{{ entries.length }}</span>
		</h3>
		<h3
			v-else
			class="rp-al-shelf__heading"
		>
			<button
				type="button"
				class="rp-al-shelf__head"
				:aria-expanded="expanded"
				:aria-controls="listId"
				@click="$emit('toggle')"
			>
				<svg
					class="rp-al-shelf__chevron"
					:class="{ 'rp-al-shelf__chevron--open': expanded }"
					viewBox="0 0 12 12"
					aria-hidden="true"
				>
					<path d="M4.5 2.5 L8.5 6 L4.5 9.5" />
				</svg>
				<span class="rp-al-shelf__name">{{ label }}</span>
				<span class="rp-al-shelf__count">{{ entries.length }}</span>
			</button>
		</h3>
		<ul
			v-show="(expanded || !collapsible) && entries.length > 0"
			:id="listId"
			class="rp-al-rows"
		>
			<AssetRow
				v-for="(entry, ordinal) in sortedEntries"
				:key="entry.assetId"
				:entry="entry"
				:outline="outlineOf(entry.assetId)"
				:selected="entry.assetId === selectedId"
				:ordinal="ordinal"
				@select="$emit('select', $event)"
			/>
		</ul>
	</section>
</template>
