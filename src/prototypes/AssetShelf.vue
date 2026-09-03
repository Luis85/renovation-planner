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
-->
<script setup lang="ts">
import { useId } from 'vue';
import AssetMark from './AssetMark.vue';
import { spokenMarkFor } from './assetShapeFields';
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
 * `useId()` is what the rest of this plugin mints with (`FieldError.vue`), and both real Vue
 * apps set `app.config.idPrefix` so two of them cannot collide either.
 */
const listId = useId();
/** One prefix per shelf; each row appends its own id, which is unique within the vault. */
const markId = useId();
/**
 * The symbol where one is unambiguous, the ISO code where it is not.
 *
 * An asset carries its own currency and a project carries its own (PRD §72), so a vault-wide
 * catalogue is legitimately mixed — the row hard-coded `€` and reported the wrong currency for
 * anything else, which is a lie about a number rather than a cosmetic slip. `CHF` has no symbol
 * in common use and `$` is ambiguous across several currencies, so both print their code; a
 * promoted component resolves this through the locale rather than through a table this size.
 */
const SYMBOLS: Readonly<Record<string, string>> = { EUR: '€', GBP: '£' };
const price = (asset: CatalogueAsset): string => {
	const symbol = SYMBOLS[asset.currency];
	return symbol === undefined ? `${asset.unitCost} ${asset.currency}` : `${symbol}${asset.unitCost}`;
};
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
				v-for="asset in assets"
				:key="asset.id"
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
					:aria-describedby="`${markId}-${asset.id}`"
					@click="$emit('select', asset.id)"
				>
					<AssetMark
						:asset="asset"
						:selected="asset.id === selectedId"
					/>
					<span
						:id="`${markId}-${asset.id}`"
						class="rp-al-row__mark-words"
					>{{ spokenMarkFor(asset) }}</span>
					<span class="rp-al-row__name">{{ asset.name }}</span>
					<span
						v-if="showCategory"
						class="rp-al-row__category"
					>{{ asset.category }}</span>
					<span class="rp-al-row__cost">
						<span class="rp-al-row__amount">{{ price(asset) }}</span>
						<span class="rp-al-row__unit"> / {{ asset.unit }}</span>
					</span>
					<span class="rp-al-row__waste">{{ asset.waste ?? '' }}</span>
					<span class="rp-al-row__supplier">{{ asset.supplier ?? '' }}</span>
				</button>
			</li>
		</ul>
	</section>
</template>

<style scoped>
.rp-al-shelf__heading,
.rp-al-shelf__static {
	margin: 0;
	font-size: var(--font-ui-small);
	font-weight: var(--font-medium);
}

/*
 * The whole header row is the target, at `--size-4-6` — WCAG 2.5.8 asks 24px, and the harness
 * index shipped 19.5px rows once, found by photographing the page rather than by any gate.
 * Obsidian's own `button:not(.clickable-icon)` is (0,1,1) and sets a background and a colour,
 * so this is selected under `.rp-al-shelf` to outrank it — the loss `buttonSpecificity.test.ts`
 * refuses as a category for every shipping row in this plugin.
 */
.rp-al-shelf .rp-al-shelf__head {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
	width: 100%;
	min-height: var(--size-4-6);
	padding: var(--size-2-2) var(--size-4-3);
	border: none;
	border-radius: 0;
	background-color: transparent;
	color: var(--text-normal);
	font-size: inherit;
	font-weight: inherit;
	text-align: left;
	cursor: pointer;
}

.rp-al-shelf .rp-al-shelf__head:hover {
	background-color: var(--background-modifier-hover);
}

/* Obsidian's global `:focus { outline: none }` reaches buttons and the vendored reduction puts
   nothing back that clears WCAG 1.4.11's 3:1 floor, so every interactive class here states its
   own ring. Negative offset: these rows run edge to edge and an outside ring would be clipped. */
.rp-al-shelf .rp-al-shelf__head:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

/*
 * The two headings with NO control, and they carry a class of their own rather than the button's.
 *
 * They used to share `rp-al-shelf__head`, which sets `cursor: pointer` and takes a hover
 * background — so an empty shelf and the fixed Results heading presented exactly the disclosure
 * affordance of a real one while clicking them did nothing. The whole point of rendering them as
 * plain headings was to remove that affordance, and the shared class put it straight back.
 * Reported by a review bot; no capture could have shown it, because a cursor and a hover state
 * are not in a resting screenshot.
 *
 * Every other rule is deliberately identical to the button's, so all three headings sit on one
 * left edge and one baseline. The empty one is faint because it holds nothing; a result list is
 * the thing the user is looking at.
 */
.rp-al-shelf__static {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
	min-height: var(--size-4-6);
	/* The chevron's own width plus its gap, so an empty shelf's label sits on the same left
	   edge as a full one's rather than shifting into the space the control vacated. */
	padding: var(--size-2-2) var(--size-4-3) var(--size-2-2) calc(var(--size-4-3) + 12px + var(--size-4-2));
}

.rp-al-shelf__static--empty {
	color: var(--text-faint);
}

.rp-al-shelf__chevron {
	flex: 0 0 auto;
	width: 12px;
	height: 12px;
	fill: none;
	stroke: currentColor;
	stroke-width: 1.5;
	stroke-linecap: round;
	stroke-linejoin: round;
	color: var(--text-muted);
	transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.rp-al-shelf__chevron--open {
	transform: rotate(90deg);
}

@media (prefers-reduced-motion: reduce) {
	.rp-al-shelf__chevron {
		transition: none;
	}
}

.rp-al-shelf__name {
	flex: 1 1 auto;
	min-width: 0;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.rp-al-shelf__count {
	flex: 0 0 auto;
	color: var(--text-faint);
	font-variant-numeric: tabular-nums;
	font-weight: var(--font-normal);
}

.rp-al-rows {
	margin: 0 0 var(--size-4-2);
	padding: 0;
	list-style: none;
}

/*
 * The row. A GRID rather than a flex row, for the reason `project-detail.css` records paying
 * for twice: with a flexible name beside two or three `auto` items, the slack lands wherever
 * each name's length leaves it and the right-hand facts stop forming columns. Fixed tracks
 * after the flexible one keep the cost, the waste and the supplier each in their own column
 * down the whole shelf, which is the entire argument for a dense row over a flat one.
 *
 * **What "a column" means here, precisely: the cost strings END in a column, and their decimal
 * points do not line up.** The unit suffix is part of the cost cell and its width varies — `m²`
 * against `m` against `piece` — so with the right edge fixed the amounts sit ragged inside it,
 * and tabular numerals cannot correct a difference that comes from the letters after them.
 * Aligning the decimals means giving the amount and the unit separate tracks: a markup change
 * plus all five grid variants, for a refinement over a treatment — right-aligned complete
 * prices — that is ordinary and readable. Not taken, and written here rather than left for the
 * next reader to discover the promise is looser than it sounds. Reported by a review bot.
 *
 * **The waste track is a FIXED width, and that is what makes the sentence above true.** Every row
 * is its own grid — no subgrid, no shared sizing — so an `auto` track sizes to ITS row's content:
 * zero on the rows with no waste factor, wider on the rest. The cost cell beside it shifts by
 * that difference and the prices stop forming the column this comment promises, tabular numerals
 * notwithstanding. It asserted exactly what the `auto` beside it prevented, for the whole life of
 * this file, and was found by a review bot rather than by any gate: jsdom lays nothing out, and
 * the misalignment is a few pixels in captures nobody was measuring. `5ch` fits `+12%`; a
 * three-digit factor would overflow it, which is a bound worth knowing rather than a case worth
 * widening for.
 */
/*
 * Visually hidden and still announced — the standard clip rectangle rather than `display: none`
 * or `visibility: hidden`, both of which take the text out of the accessibility tree with the
 * pixels. `aria-describedby` rather than a plain descendant: a text node inside the button JOINS
 * its accessible name, and this one precedes the asset's name in DOM order, so rows announced
 * "Measured footprint, 1200 × 190 mm Oak plank floor". The description follows the name instead.
 */
.rp-al-row__mark-words {
	position: absolute;
	width: 1px;
	height: 1px;
	margin: -1px;
	padding: 0;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
	border: 0;
}

.rp-al-shelf .rp-al-row {
	display: grid;
	grid-template-columns: 20px minmax(0, 1fr) auto 5ch minmax(0, 16ch);
	align-items: center;
	gap: var(--size-4-2);
	width: 100%;
	min-height: var(--size-4-6);
	padding: var(--size-2-1) var(--size-4-3) var(--size-2-1) var(--size-4-4);
	border: none;
	border-radius: 0;
	background-color: transparent;
	color: var(--text-normal);
	font-size: var(--font-ui-small);
	text-align: left;
	cursor: pointer;
}

/*
 * A SIXTH slot, and it needs its own template rather than an implicit track. In a search result
 * list the row carries the category the shelf would otherwise have said, so the child count goes
 * from five to six; grid then invents an implicit column and every value after the name lands one
 * track out of place. Reported by a review bot against a state no capture had photographed —
 * the mock opens unsearched, so nothing had ever drawn this row.
 */
.rp-al-shelf .rp-al-row--categorised {
	grid-template-columns: 20px minmax(0, 1fr) minmax(0, 10ch) auto 5ch minmax(0, 16ch);
}

.rp-al-shelf .rp-al-row:hover {
	background-color: var(--background-modifier-hover);
}

.rp-al-shelf .rp-al-row:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}

/*
 * Selection is a PRINTED MARK before it is a colour: a filled rule at the row's leading edge,
 * plus `aria-current` in the markup, with the tint riding along as a third channel and never as
 * the only one. PRODUCT.md forbids state carried by colour alone, and a list row is where that
 * is easiest to lose. The rule is drawn with `box-shadow` rather than a border so it costs no
 * layout and cannot shift the grid by 2px against every unselected row beside it.
 */
.rp-al-shelf .rp-al-row--on {
	background-color: var(--background-modifier-active-hover);
	box-shadow: inset 2px 0 0 0 var(--interactive-accent);
	font-weight: var(--font-medium);
}

.rp-al-row__name {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.rp-al-row__category,
.rp-al-row__supplier {
	overflow: hidden;
	color: var(--text-faint);
	font-size: var(--font-ui-smaller);
	white-space: nowrap;
	text-overflow: ellipsis;
}

/* Tabular numerals so the decimal points line up down the shelf. A price column that does not
   align is a price column a reader has to parse one row at a time. */
.rp-al-row__cost {
	white-space: nowrap;
}

/* Tabular numerals on the amount alone: it is the column a reader runs an eye down, and the
   unit beside it is a word. A price column whose decimal points do not line up is one that has
   to be parsed a row at a time. */
.rp-al-row__amount {
	font-variant-numeric: tabular-nums;
}

.rp-al-row__unit {
	color: var(--text-muted);
}

.rp-al-row__waste {
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	font-variant-numeric: tabular-nums;
}

/*
 * The two droppable slots. A CONTAINER query and never a media query: this surface's width is
 * its PANE's — the window minus both Obsidian sidebars minus whatever is split beside it — and
 * `docs/user-experience/concepts/README.md` records what measuring the wrong box costs, a canvas
 * given 67% of a 1440px pane and 29% of a 680px one. The container is declared on the shelves
 * region in `AssetLibrary.vue`.
 */
@container rp-al-shelves (width < 40rem) {
	.rp-al-shelf .rp-al-row {
		grid-template-columns: 20px minmax(0, 1fr) auto 5ch;
	}

	.rp-al-shelf .rp-al-row--categorised {
		grid-template-columns: 20px minmax(0, 1fr) minmax(0, 8ch) auto 5ch;
	}

	.rp-al-row__supplier {
		display: none;
	}
}

@container rp-al-shelves (width < 32.5rem) {
	.rp-al-shelf .rp-al-row {
		grid-template-columns: 20px minmax(0, 1fr) auto;
	}

	.rp-al-shelf .rp-al-row--categorised {
		grid-template-columns: 20px minmax(0, 1fr) minmax(0, 8ch) auto;
	}

	.rp-al-row__waste {
		display: none;
	}
}
</style>
