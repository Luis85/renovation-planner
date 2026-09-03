<!--
	The Asset library's shelves REGION (design "Asset library overview" §3.2, §6.1): the
	category-shelf list when nothing is being searched for, and the one flattened Results shelf
	when something is.

	**Ported from `src/prototypes/AssetLibrary.vue`'s own `shelves` computed and its two
	`<AssetShelf>` template branches** — the mock's `matches`/`searching` logic is the root's
	(§4's states own it, since a zero-match list is `noMatches` and replaces this whole region
	rather than something this component renders), but the DERIVATION of which shelves exist,
	in which order, is this component's own per the brief's own hand-off: Task 12 built the
	shelf and the row; nothing before this task built the LIST of shelves.

	**The two-group derivation, verbatim from §3.2**: every category the build declares, in
	`ASSET_CATEGORY_LABELS`'s own key order — which is the order `NewAssetForm`'s `<select>`
	renders, because that control iterates the same Record (`NewAssetForm.vue`'s `CATEGORIES`),
	so the category a user picked in the form is in the position they picked it from. **That
	Record and not `ASSET_CATEGORIES`**, which is a correction rather than a detail: for one
	review round this derivation read the ARRAY while this paragraph claimed the Record. The two
	agree today, so nothing was visibly wrong — and a category inserted at a different position
	in one of them would have parted the shelves from the form silently, with the shelf-order
	test asserting against the code's source rather than the spec's. One source now, and
	`assetLibraryRoot.test.ts` compares the shelf order against the form's own rendered control
	rather than against either list. ALL of them, including the ones holding nothing — then every category the passed-in `entries` actually name that the build does not
	declare, ordered by `localeCompare` under the resolved language and kept AS WRITTEN, never
	case-folded or retitled. Group 2 is UNREACHABLE in today's code — an unrecognised category
	never becomes an `Asset` at all (`kebabEnum(ASSET_CATEGORIES)` answers `z.NEVER` and
	`Asset.create` refuses independently), so such a note is skipped by `listAll()` and lands in
	the unreadable strip instead — and the derivation stays general anyway: it is simpler than
	special-casing group 1, and it populates with no edit to this file the day §84 opens the
	vocabulary. No case here asserts group 2 draws a shelf, because nothing can seed one, and a
	case that could not fail would pass for the wrong reason and certify a gap that is not
	closed.

	`expanded` is owned by the PARENT (`AssetLibraryRoot.vue`) rather than here, deliberately:
	§6.1 requires clearing a search to restore "the shelves and their prior expansion state",
	and this component itself unmounts whenever the empty-state registry answers `noMatches`
	(the root replaces the whole shelves region, per §4) — a local `ref` here would be
	destroyed with it and reset to nothing the moment a search matches zero rows before it is
	cleared. A value the parent holds survives that swap because the parent never unmounts.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetCategory } from '../../domain/asset/AssetCategory';
import { ASSET_CATEGORY_LABELS } from '../views/assetLabels';
import { currentLanguage, tr } from '../i18n/strings';
import AssetShelf from './AssetShelf.vue';

const props = withDefaults(
	defineProps<{
		/** §6.1's matches, or the whole catalogue when nothing is being searched for — already
		 *  filtered and ordered by name by `AssetLibraryStore.visibleEntries`. Never re-sorted
		 *  here: `AssetShelf` sorts what it is handed on its own account, and re-deriving an
		 *  order this component was already given is a second answer to one question. */
		entries: readonly CatalogueEntryDto[];
		/** Whether §6.1's search field holds a query — `AssetLibraryStore.searching`. */
		searching: boolean;
		/** Which declared OR undeclared category headers are open — the parent's, per this
		 *  file's own header. */
		expanded: ReadonlySet<string>;
		selectedId?: AssetId | null;
		/** `null` for §3.4's *not yet read* — a shelf never waits for its own rows' marks. */
		outlineFor?: (assetId: AssetId) => AssetOutline | null;
	}>(),
	{ selectedId: null, outlineFor: undefined },
);

const emit = defineEmits<{ toggle: [category: string]; select: [assetId: AssetId] }>();

interface Shelf {
	readonly category: string;
	readonly label: string;
	readonly entries: readonly CatalogueEntryDto[];
}

/** §6.1's own flat heading, resolved once rather than inline in the template. */
const resultsLabel = computed((): string => tr('view.asset-library.results'));

/**
 * §3.2's two groups. `byCategory` is built in one pass over `entries` so the derivation costs
 * one iteration regardless of the catalogue's size, and the collator is the RESOLVED
 * language's — a bare `new Intl.Collator()` sorts under the environment's locale, which
 * CLAUDE.md's own account of this branch already records finding twice on this exact surface
 * (the rows, and then the shelves themselves).
 */
/** §3.2's group-1 ORDER and group-1 MEMBERSHIP, from one source. The `Record` type makes every
 *  `AssetCategory` present, so the cast asserts nothing the compiler has not already checked —
 *  `NewAssetForm`'s own `CATEGORIES` is the identical expression. */
const DECLARED: readonly AssetCategory[] = Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[];

const shelves = computed((): readonly Shelf[] => {
	const declared = new Set<string>(DECLARED);
	const byCategory = new Map<string, CatalogueEntryDto[]>();
	for (const entry of props.entries) {
		const bucket = byCategory.get(entry.category);
		if (bucket === undefined) byCategory.set(entry.category, [entry]);
		else bucket.push(entry);
	}
	// `collator.compare` passed BY REFERENCE rather than wrapped in `(a, b) => …`: ECMA-402
	// defines it as an accessor returning an already-bound function, so the wrapper adds
	// nothing — and the wrapper is a function `toSorted` calls only for a SECOND undeclared
	// category, which group 2 being unreachable (see this file's header) means nothing in this
	// tree can produce. A wrapper no test can reach is one this repository's own rule refuses
	// to cover artificially, so the honest answer is not to write it.
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

function outlineOf(assetId: AssetId): AssetOutline | null {
	return props.outlineFor?.(assetId) ?? null;
}
</script>

<template>
	<div class="rp-al-shelves">
		<AssetShelf
			v-if="searching"
			:label="resultsLabel"
			:entries="entries"
			:expanded="true"
			:collapsible="false"
			:selected-id="selectedId"
			:outline-for="outlineFor"
			@select="emit('select', $event)"
		/>
		<template v-else>
			<AssetShelf
				v-for="shelf in shelves"
				:key="shelf.category"
				:label="shelf.label"
				:entries="shelf.entries"
				:expanded="expanded.has(shelf.category)"
				:collapsible="true"
				:selected-id="selectedId"
				:outline-for="outlineOf"
				@toggle="emit('toggle', shelf.category)"
				@select="emit('select', $event)"
			/>
		</template>
	</div>
</template>
