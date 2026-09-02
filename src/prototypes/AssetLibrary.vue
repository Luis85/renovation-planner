<!--
	The asset library overview, drawn before it is built.

	Specified in `docs/user-experience/asset-library-overview-DESIGN-SPEC.md`; this is that
	document's §12, the look that has to happen before any of it is wired. The structure came out
	of an impeccable surface roll (seed 140a13d1) as CATEGORY SHELVES: the library as a builder's
	merchant with departments, where finding what you already defined is a matter of recognition —
	"it'd be under Fixture" — rather than of recalling a name.

	**What this mock exists to show, because jsdom can show none of it.** Seven shelf headings
	with several of them empty; a 20px footprint mark beside a 13px name; a dense row losing two
	of its five slots at a sidebar leaf's width; a selected row's leading rule against the hover
	tint in both schemes; and a two-column definition list surviving 460px. Every one of those is
	a measurement no layout engine in this repository performs, and ten defects have been found
	this way that all four gates passed.

	**It is interactive on purpose.** Shelves open and close, rows select, and the search field
	really filters — because half of what a browsing surface IS lives in its states, and a
	reviewer looking at a static list cannot judge the one thing a library is: what it does when
	you look for something. `src/prototypes/README.md` records the three constraints a
	template-only mock accepts, and a list view is the case where all three bite.

	**Not built here, and each absence is a decision rather than an omission.** No editing — the
	inspector is the read side, and committing its fields on blur through `useFieldCommit` is the
	promoted component's job against the real `UpdateAsset`. No delete flow, which is slice 15's
	dialog over slice 10's resolution. No loading, failure or unreadable states; the spec's §4
	tabulates all six, and drawing them needs the real query's shapes rather than a fixture's.

	Every asset, price, supplier and project name is invented and labelled as such where the data
	lives (`assetLibraryFixture.ts`). PRODUCT.md: there is no real project, no real quote and no
	real cost data anywhere in this repository.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
import AssetInspector from './AssetInspector.vue';
import AssetShelf from './AssetShelf.vue';
import { ASSETS, CATEGORIES, type CatalogueAsset } from './assetLibraryFixture';

const query = ref('');
/*
 * Material and Furniture open on purpose. Between them one capture holds every state the row's
 * mark can be in — measured, none, unscaled and pending — beside a closed shelf and an empty
 * one. The first capture opened Material and Fixture, and the two states that most need an eye
 * on them, `unscaled` and `pending`, were both inside a shelf that happened to be shut.
 */
const expanded = ref(new Set<string>(['Material', 'Furniture']));
const selectedId = ref<string | null>('oak-plank-floor');

const matches = computed((): readonly CatalogueAsset[] => {
	const needle = query.value.trim().toLowerCase();
	if (needle === '') return ASSETS;
	// Name, supplier and SKU — never notes, whose matches would be unexplainable in a row that
	// does not show them.
	return ASSETS.filter((a) =>
		`${a.name} ${a.supplier ?? ''} ${a.sku ?? ''}`.toLowerCase().includes(needle));
});

/*
 * Also what returns the narrow composition to the shelves: below 35rem the inspector owns the
 * whole pane, so with this reading only `selected !== null` a user typing into the search field
 * filtered a list they could not see and the surface appeared to ignore them. Found by looking
 * at the 460px capture, which is the width that composition only exists for.
 */
const searching = computed(() => query.value.trim() !== '');
const selected = computed(() => ASSETS.find((a) => a.id === selectedId.value) ?? null);
const shelfOf = (category: string): readonly CatalogueAsset[] =>
	matches.value.filter((a) => a.category === category);

function toggle(category: string): void {
	const next = new Set(expanded.value);
	if (!next.delete(category)) next.add(category);
	expanded.value = next;
}
</script>

<template>
	<div
		class="rp-al"
		:class="{ 'rp-al--inspecting': selected !== null && !searching }"
	>
		<div class="rp-al-toolbar">
			<label class="rp-al-search">
				<span class="rp-al-search__label">Search the library</span>
				<input
					v-model="query"
					type="search"
					class="rp-al-search__input"
					placeholder="Name, supplier or SKU"
					@keydown.esc="query = ''"
				>
			</label>
			<button
				type="button"
				class="rp-al-create"
			>
				New asset
			</button>
		</div>

		<div class="rp-al-body">
			<div class="rp-al-shelves">
				<p
					v-if="searching"
					class="rp-al-results"
					role="status"
				>
					{{ matches.length }} matching assets
				</p>
				<AssetShelf
					v-if="searching && matches.length > 0"
					label="Results"
					:assets="matches"
					:expanded="true"
					:selected-id="selectedId"
					:show-category="true"
					@select="selectedId = $event"
				/>
				<div
					v-else-if="searching"
					class="rp-al-nothing"
				>
					<p class="rp-al-nothing__head">
						Nothing matches “{{ query }}”
					</p>
					<p class="rp-al-nothing__body">
						No asset's name, supplier or SKU contains it. Notes are not searched.
					</p>
					<button
						type="button"
						class="rp-al-nothing__action"
						@click="query = ''"
					>
						Clear search
					</button>
				</div>
				<AssetShelf
					v-for="category in (searching ? [] : CATEGORIES)"
					:key="category"
					:label="category"
					:assets="shelfOf(category)"
					:expanded="expanded.has(category)"
					:selected-id="selectedId"
					@toggle="toggle(category)"
					@select="selectedId = $event"
				/>
			</div>

			<AssetInspector
				:asset="selected"
				@back="selectedId = null"
			/>
		</div>

		<footer class="rp-al-status">
			<span>{{ ASSETS.length }} assets</span>
			<span class="rp-al-status__sep" />
			<span class="rp-al-status__folder">Renovation/Library</span>
		</footer>
	</div>
</template>

<style scoped>
.rp-al {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
	container: rp-al / inline-size;
	background-color: var(--background-primary);
	color: var(--text-normal);
}

.rp-al-toolbar {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
	padding: var(--size-4-2) var(--size-4-3);
	border-bottom: 1px solid var(--background-modifier-border);
}

.rp-al-search {
	flex: 1 1 auto;
	min-width: 0;
	/* Capped rather than greedy: at a main pane's width an unbounded field is a 1160px input
	   for a word, which reads as a page that has not been laid out. It still takes the whole
	   toolbar in a sidebar leaf, where the cap never binds. */
	max-width: 22rem;
}

/* Visually hidden rather than absent: a placeholder is a hint and never a label, and the
   accessibility suite scans an entry open on the stage, so an unlabelled control here is a real
   failure rather than a mock's licence. */
.rp-al-search__label {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}

.rp-al-search__input {
	width: 100%;
}

.rp-al-toolbar .rp-al-create:focus-visible,
.rp-al-nothing .rp-al-nothing__action:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}

.rp-al-body {
	display: flex;
	flex: 1 1 auto;
	min-height: 0;
}

/*
 * The shelves are their own container, so a row's droppable slots measure the region they
 * actually sit in rather than the pane — which matters precisely because the inspector beside
 * them takes 280px of it. A CONTAINER query and never a media query:
 * `docs/user-experience/concepts/README.md` records what measuring the wrong box costs, a canvas
 * given 67% of a 1440px pane and 29% of a 680px one.
 */
.rp-al-shelves {
	flex: 1 1 auto;
	min-width: 0;
	min-height: 0;
	padding-top: var(--size-4-2);
	overflow-y: auto;
	container: rp-al-shelves / inline-size;
}

.rp-al-results {
	margin: 0;
	padding: 0 var(--size-4-3) var(--size-4-2);
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}

.rp-al-nothing {
	padding: var(--size-4-8) var(--size-4-4);
	text-align: center;
}

.rp-al-nothing__head {
	margin: 0 0 var(--size-4-1);
	font-weight: var(--font-medium);
}

.rp-al-nothing__body {
	margin: 0 0 var(--size-4-3);
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	line-height: var(--line-height-normal);
}

.rp-al-status {
	display: flex;
	align-items: center;
	gap: var(--size-4-2);
	padding: var(--size-2-2) var(--size-4-3);
	border-top: 1px solid var(--background-modifier-border);
	color: var(--text-faint);
	font-size: var(--font-ui-smaller);
}

.rp-al-status__sep {
	width: 3px;
	height: 3px;
	border-radius: 50%;
	background-color: currentColor;
}

.rp-al-status__folder {
	min-width: 0;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

/*
 * Below 35rem there is one pane at a time. The inspector's own file carries the half that makes
 * it fill the pane; this is the half that gets the shelves out of its way, and the two are
 * separate because a scoped rule may not reach into a composed component's markup — which is
 * `prototype-styles.test.ts`'s rule and also just true of how Vue scoping works.
 */
@container rp-al (width < 35rem) {
	.rp-al--inspecting .rp-al-shelves {
		display: none;
	}
}
</style>
