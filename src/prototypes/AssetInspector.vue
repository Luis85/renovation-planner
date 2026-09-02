<!--
	The asset library's inspector: how one catalogue entry is defined, what shape it has, and
	which projects lean on it.

	A region of its own rather than markup inside `AssetLibrary.vue`, for the reason
	`src/prototypes/README.md` gives and this repository has already paid for once: `max-lines`
	is 400 and the shell crossed it at 463 with this panel inline. The seam is a real one — the
	inspector is the surface's second pane and the one that replaces the first below 35rem — so
	the split is where the screen already bends.

	**The definition list is deliberately the vocabulary the other two surfaces already use.**
	`.rp-editor-inspector-fields` and `.rp-designer-inspector-fields` are both a two-column grid
	of `<dt class="rp-al-fields__key">`/`<dd class="rp-al-fields__value">`; a user moving between the Plan editor, the Asset designer and this must not
	be able to tell that three people wrote them.

	**Read-only, on purpose.** The promoted component commits these fields on blur through
	`useFieldCommit` against the real `UpdateAsset` and `SetAssetHeight`, both of which already
	exist — so the maintenance job needs no new command, only this surface. Mocking the commit
	would mock the one part that is not in question.

	`Used in` is loaded per SELECTION in the specification, never per row: the query behind it
	reads every requirement in every project, so a column would make opening the library
	O(requirements). What that costs is that "which of these is unused" cannot be scanned — it
	has to be asked asset by asset, which is exactly what this panel is.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { ASSETS, type CatalogueAsset } from './assetLibraryFixture';

/**
 * Defaulted for the same reason `AssetShelf.vue` is: the harness index mounts an entry bare, and
 * a region that needs a parent to exist is a region nobody looks at. The default is a real asset
 * rather than `null` because the resting line is the LESS informative of the two states, and a
 * specimen should open on what it is for. `null` still reaches it from the shell — a default
 * applies to an absent prop, never to an explicit `null`.
 */
const props = withDefaults(defineProps<{
	asset?: CatalogueAsset | null;
	/**
	 * "Give the pane back", asked by the shell rather than decided here. Below 35rem this panel
	 * IS the pane, so while a search is running it has to withdraw or the shelves it is meant to
	 * yield to draw underneath it. The selection is deliberately not cleared to achieve that: a
	 * user clearing the search field should find the panel they were reading, not an empty rail.
	 */
	withdraw?: boolean;
}>(), {
	asset: () => ASSETS[0] as CatalogueAsset,
	withdraw: false,
});

const SYMBOLS: Readonly<Record<string, string>> = { EUR: '€', GBP: '£' };
/** The row's rule, stated once more here rather than shared: see `AssetShelf.vue`'s own note. */
const price = computed((): string => {
	const asset = props.asset;
	if (asset === null) return '';
	const symbol = SYMBOLS[asset.currency];
	return symbol === undefined ? `${asset.unitCost} ${asset.currency}` : `${symbol}${asset.unitCost}`;
});
defineEmits<{ back: [] }>();

/** Width × depth in millimetres, from the footprint's own extent — derived, never typed (§88). */
const dimensions = computed((): string | null => {
	const outline = props.asset?.outline;
	if (!outline) return null;
	const xs = outline.map((point) => point.x);
	const ys = outline.map((point) => point.y);
	const width = Math.round(Math.max(...xs) - Math.min(...xs));
	const depth = Math.round(Math.max(...ys) - Math.min(...ys));
	return `${width} × ${depth} mm`;
});

const shapeNote = computed((): string | null => {
	switch (props.asset?.shape) {
		case 'unscaled': return 'Traced before a scale existed, so these are not measurements yet.';
		case 'none': return 'No outline. This asset has nothing to draw on a plan.';
		case 'pending': return 'Reading the shape…';
		default: return null;
	}
});
</script>

<template>
	<aside
		class="rp-al-inspector"
		:class="{ 'rp-al-inspector--rest': asset === null || withdraw }"
	>
		<button
			type="button"
			class="rp-al-inspector__back"
			@click="$emit('back')"
		>
			Back to library
		</button>
		<p
			v-if="asset === null"
			class="rp-al-inspector__rest"
		>
			Select an asset to see how it is defined and where it is used.
		</p>
		<template v-else>
			<h2 class="rp-al-inspector__name">
				{{ asset.name }}
			</h2>
			<dl class="rp-al-fields">
				<dt class="rp-al-fields__key">
					Category
				</dt>
				<dd class="rp-al-fields__value">
					{{ asset.category }}
				</dd>
				<dt class="rp-al-fields__key">
					Unit
				</dt>
				<dd class="rp-al-fields__value">
					{{ asset.unit }}
				</dd>
				<dt class="rp-al-fields__key">
					Unit cost
				</dt>
				<dd class="rp-al-fields__value rp-al-fields__num">
					{{ price }}
				</dd>
				<dt class="rp-al-fields__key">
					Waste
				</dt>
				<dd class="rp-al-fields__value rp-al-fields__num">
					{{ asset.waste ?? 'none' }}
				</dd>
				<dt class="rp-al-fields__key">
					Supplier
				</dt>
				<dd class="rp-al-fields__value">
					{{ asset.supplier ?? '—' }}
				</dd>
				<dt class="rp-al-fields__key">
					SKU
				</dt>
				<dd class="rp-al-fields__value">
					{{ asset.sku ?? '—' }}
				</dd>
				<template v-if="asset.heightMm !== null">
					<dt class="rp-al-fields__key">
						Height
					</dt>
					<dd class="rp-al-fields__value rp-al-fields__num">
						{{ asset.heightMm }} mm
					</dd>
				</template>
			</dl>
			<p
				v-if="asset.notes !== null"
				class="rp-al-note"
			>
				{{ asset.notes }}
			</p>

			<h3 class="rp-al-inspector__title">
				Shape
			</h3>
			<dl
				v-if="dimensions !== null"
				class="rp-al-fields"
			>
				<dt class="rp-al-fields__key">
					Footprint
				</dt>
				<dd class="rp-al-fields__value rp-al-fields__num">
					{{ dimensions }}
				</dd>
			</dl>
			<p
				v-if="shapeNote !== null"
				class="rp-al-note"
			>
				{{ shapeNote }}
			</p>

			<h3 class="rp-al-inspector__title">
				Used in
			</h3>
			<ul
				v-if="asset.usedIn.length > 0"
				class="rp-al-used"
			>
				<li
					v-for="use in asset.usedIn"
					:key="use.project"
					class="rp-al-used__row"
				>
					<span class="rp-al-used__project">{{ use.project }}</span>
					<span class="rp-al-used__count">{{ use.requirements }}</span>
				</li>
			</ul>
			<p
				v-else
				class="rp-al-note"
			>
				Not used in any project.
			</p>

			<div class="rp-al-actions">
				<button
					type="button"
					class="rp-al-action"
				>
					Open designer
				</button>
				<button
					type="button"
					class="rp-al-action"
				>
					Open note
				</button>
			</div>
		</template>
	</aside>
</template>

<style scoped>
.rp-al-inspector {
	flex: 0 0 280px;
	min-height: 0;
	padding: var(--size-4-3);
	border-left: 1px solid var(--background-modifier-border);
	overflow-y: auto;
	background-color: var(--background-secondary);
}

/* Obsidian's global `:focus { outline: none }` reaches buttons and the vendored reduction puts
   nothing back that clears WCAG 1.4.11's 3:1 floor. Positive offset: these controls are inset
   and have the room, unlike the edge-to-edge rows. */
.rp-al-inspector .rp-al-inspector__back:focus-visible,
.rp-al-inspector .rp-al-action:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}

/* The rail is a rail while there is room for one; the back control belongs to the narrow
   composition, where selecting a row replaces the shelves outright. */
.rp-al-inspector .rp-al-inspector__back {
	display: none;
}

.rp-al-inspector__rest {
	margin: 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	line-height: var(--line-height-normal);
}

.rp-al-inspector__name {
	margin: 0 0 var(--size-4-3);
	font-size: var(--font-ui-medium);
	line-height: var(--line-height-tight);
}

/* More space above a heading than below it, so the sections group rather than float. */
.rp-al-inspector__title {
	margin: var(--size-4-5) 0 var(--size-4-2);
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	font-weight: var(--font-medium);
}

.rp-al-fields {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: var(--size-2-1) var(--size-4-2);
	margin: 0;
	font-size: var(--font-ui-smaller);
}

/*
 * Every selector's subject carries a class, `dt` and `dd` included. That is
 * `tests/build/prototype-styles.test.ts`'s rule and it is not pedantry: Vue applies the
 * PARENT's scope attribute to a composed child's root element, so an element-subject rule in a
 * scoped block can still restyle a component this file merely mounts. Checked at the forbidden
 * shape rather than at the cases someone thought of, which is why it fires on markup that is
 * demonstrably this file's own.
 */
.rp-al-fields__key {
	color: var(--text-muted);
}

.rp-al-fields__value {
	margin: 0;
	overflow-wrap: anywhere;
}

/* Tabular numerals so a price, a percentage and a millimetre all sit on the same right edge
   as the eye runs down the panel. */
.rp-al-fields__num {
	font-variant-numeric: tabular-nums;
}

.rp-al-note {
	margin: var(--size-4-2) 0 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	line-height: var(--line-height-normal);
}

.rp-al-used {
	margin: 0;
	padding: 0;
	list-style: none;
	font-size: var(--font-ui-smaller);
}

.rp-al-used__row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: var(--size-4-2);
	padding: var(--size-2-1) 0;
	border-bottom: 1px solid var(--background-modifier-border);
}

/* The rule between rows is a separator, so the last one has nothing to separate and dangles
   under the list as a stray line. Seen in the first capture; jsdom draws no borders. */
.rp-al-used__row:last-child {
	border-bottom: none;
}

.rp-al-used__project {
	min-width: 0;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

.rp-al-used__count {
	flex: 0 0 auto;
	color: var(--text-muted);
	font-variant-numeric: tabular-nums;
}

.rp-al-actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-2);
	margin-top: var(--size-4-5);
}

/*
 * BELOW 35rem THE RAIL STOPS BEING A RAIL — the container is declared on the shell's root. At
 * 460px, an Obsidian sidebar leaf's real width, two columns is not a tight layout but two
 * unusable ones, so the inspector takes the pane and a back control returns. That is the
 * one-pane-at-a-time move `ProjectDetailState` already makes, so a user meets one idea and not
 * two.
 */
/*
 * The ladder's middle rung, which shipped missing. §7 specifies 280px at 45rem and above, 240px
 * between 35 and 45, and one pane below 35 — and only the last of the three had a rule, so a
 * 700px pane kept the full rail and took 40px from the shelves at exactly the width where the
 * dense row is already dropping slots. Reported by a review bot; no capture had been taken
 * between the two widths that were.
 */
@container rp-al (width < 45rem) {
	.rp-al-inspector {
		flex-basis: 240px;
	}
}

@container rp-al (width < 35rem) {
	.rp-al-inspector {
		flex: 1 1 auto;
		border-left: none;
		background-color: var(--background-primary);
	}

	.rp-al-inspector .rp-al-inspector__back {
		display: inline-flex;
	}

	/*
	 * With nothing selected the pane belongs to the shelves, so the resting panel withdraws
	 * rather than sitting under them as a second empty region. The shell hides the SHELVES in
	 * the mirror-image case, and the two halves live in two files because a scoped rule may
	 * not reach into a composed component's markup — which is `prototype-styles.test.ts`'s
	 * rule and also just how Vue's scoping works.
	 */
	.rp-al-inspector--rest {
		display: none;
	}
}
</style>
