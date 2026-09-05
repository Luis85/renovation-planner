<!--
	One category shelf of the asset library — its header, its count, and its rows.

	A separate file from `AssetLibrary.vue` for two reasons, and the second is the one that
	decided it. The shelf is the surface's repeated unit, so it is what a promoted component
	takes props for; and `max-lines` is 400 here as everywhere in `src/`, which this repository
	learned by shipping `WorkPackages.vue` at 506. Deciding the decomposition before writing the
	screen is what `src/prototypes/README.md` asks for in as many words.

	**The mark is the point of this file.** Each row's leading 20px box draws the asset's own
	footprint, fitted to the box at its true aspect ratio, from the coordinates the Asset
	designer captured. It is not an icon and no asset gets a picture of its category: a radiator
	reads as the long thin thing it is because it IS 1200 × 100, and that is the product's own
	claim — geometry produces project information — visible at row scale. `aria-hidden`, always,
	with the same fact written in words in the inspector: a drawn outline that is the only
	statement of something is the colour-alone failure in a different medium.

	**An empty shelf still draws.** Seven categories, always all seven, and a shelf holding
	nothing renders its header greyed with the count `0` and no disclosure control at all — a
	plain heading rather than a disabled button, because there is nothing to expand and a
	disabled control invites a press that will never work. Six empty headings over one full one
	reads as a system with room in it; six headings silently omitted reads as a system that has
	decided what you are allowed to own, and the seven categories are the thing this structure
	asks a renovator to learn.

	No `<style>` block, since Task 12 (`src/presentation/library/AssetShelf.vue`,
	`AssetRow.vue`): this mock's classes are declared in `styles/asset-shelf.css` now, which the
	harness's assembled sheet loads the same as a shipped component's — a scoped block here would
	be a second, unreachable copy of those same rules, and `tests/build/prototype-styles.test.ts`
	refuses a mock declaring a class a real component uses. `ZoneSummary.vue`, this tree's other
	fully-promoted mock, carries no `<style>` for the identical reason.
-->
<script setup lang="ts">
import { useId } from 'vue';
import AssetMark from './AssetMark.vue';
import { spokenMarkFor } from './assetShapeFields';
import { priceOf } from './assetPrice';
import { ASSETS, type CatalogueAsset } from './assetLibraryFixture';

/**
 * Every prop is optional and defaulted, so this region draws as a SPECIMEN on the harness index
 * as well as inside `AssetLibrary.vue`. The index renders a picked entry bare — no props, no
 * parent — and CLAUDE.md already records what a region that cannot survive that costs: a shell
 * region that only exists inside the whole editor is one nobody ever looks at, and the harness
 * exists for looking. The defaults are the real fixture rather than placeholders, so the
 * specimen shows the four mark states it is here to be judged on.
 */
withDefaults(defineProps<{
	label?: string;
	assets?: readonly CatalogueAsset[];
	expanded?: boolean;
	selectedId?: string | null;
	/** A search result list is one flat run of rows, so its rows carry the category instead. */
	showCategory?: boolean;
	/**
	 * A result list is not a shelf that happens to be open: there is nothing to collapse it
	 * back into. With this false the header draws as a plain heading — no disclosure control,
	 * no `aria-expanded` — because a button that renders the affordance and can never change
	 * anything is the live-control-that-does-nothing this project's own empty-state amendment
	 * refuses. Reported by a review bot.
	 */
	collapsible?: boolean;
}>(), {
	label: 'Furniture',
	assets: () => ASSETS.filter((a) => a.category === 'Furniture'),
	expanded: true,
	selectedId: null,
	collapsible: true,
});

defineEmits<{ toggle: []; select: [id: string] }>();

/**
 * MINTED, never derived from the label.
 *
 * It was `rp-al-shelf-${label.toLowerCase().replace(/\s+/g, '-')}`, which is collision-free only
 * while the labels are a closed set of seven — and §84 is precisely the change that opens them.
 * A vault holding declared `Material` beside a preserved `material`, or `foo bar` beside
 * `foo-bar`, normalises both shelves onto one id, and then each header's `aria-controls` names
 * two elements. So the derivation broke exactly for the open category values the specification
 * exists to support, which is the sharp part: the id scheme was fine until the feature it sits
 * under arrived, and the feature was already written down two sections away. Reported by a
 * review bot.
 *
 * `useId()` is what the rest of this plugin mints with (`FieldError.vue`), and every real Vue
 * app sets `app.config.idPrefix` so two of them cannot collide either — a category held by
 * `tests/build/appIdPrefix.test.ts` rather than a count, which is what this sentence said
 * ("both real Vue apps") until two more surfaces landed on separate branches.
 */
const listId = useId();
/**
 * One prefix per shelf; each row appends its ORDINAL, never its asset id.
 *
 * `AssetFrontmatterSchemaV1` validates an id with `z.string().min(1)` alone, so a hand-authored
 * one may hold whitespace — and `aria-describedby` is a whitespace-separated IDREF LIST, so an
 * id spelled `wall tile` becomes two references (`…-wall` and `tile`) against one element whose
 * literal id contains the space. Neither resolves, and the row loses the description silently:
 * an invalid reference is not an error anywhere, it is simply nothing. The ordinal is unique
 * within this shelf and `useId()` is unique across shelves and across both Vue apps, so the
 * pair is unique without reading a value the user controls. Reported by a review bot.
 */
const markId = useId();
</script>

<template>
	<section class="rp-al-shelf">
		<h3
			v-if="assets.length === 0"
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
			<span class="rp-al-shelf__count">{{ assets.length }}</span>
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
				<span class="rp-al-shelf__count">{{ assets.length }}</span>
			</button>
		</h3>
		<ul
			v-show="(expanded || !collapsible) && assets.length > 0"
			:id="listId"
			class="rp-al-rows"
		>
			<li
				v-for="(asset, row) in assets"
				:key="asset.id"
				class="rp-al-rows__item"
			>
				<button
					type="button"
					:data-asset-id="asset.id"
					class="rp-al-row"
					:class="{
						'rp-al-row--on': asset.id === selectedId,
						'rp-al-row--categorised': showCategory,
					}"
					:aria-current="asset.id === selectedId ? 'true' : undefined"
					:aria-describedby="`${markId}-${row}`"
					@click="$emit('select', asset.id)"
				>
					<AssetMark :asset="asset" />
					<span class="rp-al-row__name">{{ asset.name }}</span>
					<span
						v-if="showCategory"
						class="rp-al-row__category"
					>{{ asset.category }}</span>
					<span class="rp-al-row__cost">
						<span class="rp-al-row__amount">{{ priceOf(asset) }}</span>
						<span class="rp-al-row__unit"> / {{ asset.unit }}</span>
					</span>
					<span class="rp-al-row__waste">{{ asset.waste ?? '' }}</span>
					<span class="rp-al-row__supplier">{{ asset.supplier ?? '' }}</span>
				</button>
				<span
					:id="`${markId}-${row}`"
					class="rp-al-row__mark-words"
				>{{ spokenMarkFor(asset) }}</span>
			</li>
		</ul>
	</section>
</template>

<style scoped>
/*
 * The one demonstrated state Task 12's real `AssetShelf.vue`/`AssetRow.vue` does not build yet:
 * §6.1's flattened search-result row, which carries the category the shelf would otherwise have
 * said. Every OTHER class this file's template writes now lives in `styles/asset-shelf.css`
 * (`tests/build/prototype-styles.test.ts` refuses a mock declaring one of those a second time),
 * so this block is deliberately narrow rather than the file's original one restored.
 *
 * Neither selector below names `.rp-al-shelf` or `.rp-al-row`, on purpose: doing so would put
 * those two shared classes back in THIS block's own declarations and reopen the very check this
 * block exists to satisfy. `scoped` already appends this component's own attribute selector to
 * every rule here, which is what gives a bare `.rp-al-row--categorised` the same two-selector
 * specificity the assembled sheet's `.rp-al-shelf .rp-al-row` carries, without spelling either
 * shared class again.
 */
.rp-al-row__category {
	overflow: hidden;
	color: var(--text-faint);
	font-size: var(--font-ui-smaller);
	white-space: nowrap;
	text-overflow: ellipsis;
}

.rp-al-row--categorised {
	grid-template-columns: 20px minmax(0, 1fr) minmax(0, 10ch) auto 5ch minmax(0, 16ch);
}

@container rp-al-shelves (width < 40rem) {
	.rp-al-row--categorised {
		grid-template-columns: 20px minmax(0, 1fr) minmax(0, 8ch) auto 5ch;
	}
}

@container rp-al-shelves (width < 32.5rem) {
	.rp-al-row--categorised {
		grid-template-columns: 20px minmax(0, 1fr) minmax(0, 8ch) auto;
	}
}
</style>
