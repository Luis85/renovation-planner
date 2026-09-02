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
import { computed, ref, watch } from 'vue';
import AssetInspector from './AssetInspector.vue';
import AssetShelf from './AssetShelf.vue';
import { ASSETS, CATEGORIES, type CatalogueAsset } from './assetLibraryFixture';

const query = ref('');
/*
 * Three open on purpose, and each earns its place in the one picture this entry rests at.
 * Material and Furniture between them hold every state the row's mark can be in — measured,
 * none, unscaled and pending — and Fixture holds the one asset priced in a currency that is not
 * the vault's usual, which is the row's other easy lie. Two shelves stay shut and one is empty,
 * so the picture also carries the three shapes a shelf itself can take.
 *
 * The first capture opened Material and Fixture, and `unscaled` and `pending` were both inside
 * the shelf that happened to be shut; the second fixed that and left the non-EUR row unseen. A
 * resting state is a choice about what gets looked at.
 */
const expanded = ref(new Set<string>(['Material', 'Furniture', 'Fixture', 'Building element']));
const selectedId = ref<string | null>('oak-plank-floor');

/**
 * Ordered by name, locale-aware, and that is a rule rather than a tidy-up: §3.2 and §6.1 both
 * specify it, and without it a shelf renders in whatever order the repository handed the rows
 * back — persistence order, which is a fact about the vault's history and not about the
 * renovation. The mock's own fixture demonstrated the gap, its Material entries being neither
 * alphabetical nor anything else a reader could predict. Reported by a review bot.
 *
 * Sorted ONCE here rather than per shelf, because every list this surface draws — a shelf, a
 * flat result run — is a filter of this one.
 */
const byName = ASSETS.toSorted((a, b) => a.name.localeCompare(b.name));

const matches = computed((): readonly CatalogueAsset[] => {
	const needle = query.value.trim().toLowerCase();
	if (needle === '') return byName;
	// Name, supplier and SKU — never notes, whose matches would be unexplainable in a row that
	// does not show them.
	return byName.filter((a) =>
		`${a.name} ${a.supplier ?? ''} ${a.sku ?? ''}`.toLowerCase().includes(needle));
});

const searching = computed(() => query.value.trim() !== '');

/**
 * WHICH PANE THE NARROW COMPOSITION IS SHOWING, as one boolean rather than two conditions that
 * can disagree — and it took two review rounds to land on, in opposite directions.
 *
 * Below 35rem this surface is one pane at a time. The first version keyed that on
 * `selected !== null` alone, so typing into the search field filtered a list the inspector was
 * covering and the surface appeared to ignore the user. The second version keyed the withdrawal
 * on `searching`, which fixed that and broke the other half: a user who found an asset through
 * search then could not open it, because selecting a result changed `selectedId` while
 * `searching` stayed true and the inspector stayed hidden. A refusal too broad, which is exactly
 * the failure mode this repository's own notes warn about — *when a fix is a refusal, write the
 * WIDENED mutation and run it, because a refusal that is too broad is silent in a way a missing
 * refusal is not.* Both rounds were reported by a review bot rather than caught by a capture,
 * because a capture shows one resting state and this is a question about a sequence.
 *
 * `pickedSinceQuery` is what separates the two: a selection made BEFORE the current search is
 * the one the search should push aside, and a selection made DURING it is the thing the user
 * just asked for. So the query field resets it and a row sets it, and everything narrow-width
 * follows from the one flag — the shelves hide when it is showing the inspector, the inspector
 * withdraws when it is not, and `Back to library` returns to the results rather than clearing
 * the field.
 */
const pickedSinceQuery = ref(true);
const inspecting = computed(() => selectedId.value !== null && pickedSinceQuery.value);
watch(query, () => { pickedSinceQuery.value = false; });

function select(id: string): void {
	selectedId.value = id;
	pickedSinceQuery.value = true;
}

/**
 * The shelves: the DECLARED vocabulary first in its declared order, every one of them drawn
 * whether or not it holds anything, then every category the vault actually names that the
 * vocabulary does not, alphabetically.
 *
 * Derived rather than written out, because the epic's Definition of Done asks for configurable
 * categories (PRD §84) and for an unrecognised one to be KEPT AS WRITTEN. A literal seven is the
 * one arrangement that cannot answer either: a configured eighth would need an edit here, and a
 * category a user typed would have nowhere to go but a bucket that renames it.
 *
 * The two groups differ in one property and it is worth saying out loud: a declared shelf can be
 * empty and an undeclared one cannot, because the only evidence it exists is an asset sitting in
 * it. So the "draw the empty ones too" rule applies to the first group alone, and needs no
 * exception for the second.
 */
const shelves = computed((): readonly string[] => {
	const declared = new Set<string>(CATEGORIES);
	const extra = [...new Set(ASSETS.map((a) => a.category))]
		.filter((c) => !declared.has(c))
		.toSorted((a, b) => a.localeCompare(b));
	return [...CATEGORIES, ...extra];
});

const selected = computed(() => ASSETS.find((a) => a.id === selectedId.value) ?? null);
const shelfOf = (category: string): readonly CatalogueAsset[] =>
	matches.value.filter((a) => a.category === category);

/**
 * §6.2's arrow-key navigation: up and down move between rows and wrap into the next shelf's
 * header at the ends.
 *
 * ONE handler on the shelves region rather than a handler per shelf, and that is what makes the
 * wrap rule fall out rather than be written: shelf headers and rows already alternate in DOM
 * order, so "the next focusable thing in this region" IS "the next row, or the next shelf's
 * header when the rows run out". A per-shelf handler would have to be told about its siblings,
 * which is a list, and this repository's own rule is that a list goes stale where a rule does
 * not.
 *
 * Reading the DOM rather than deriving from `shelves` and `matches` for the same reason: the
 * region's real order is the one the user is moving through, and a computed order is a second
 * answer that can drift from it — a collapsed shelf's rows are `v-show`n rather than removed,
 * so a derived list would happily focus something nobody can see. `:not([hidden])` plus
 * `offsetParent` is what excludes them; jsdom reports neither, which is why this is checked by
 * an eye in the harness rather than by the suite.
 *
 * The prototype carries it because §6.2 is a contract, and a mock that draws every state while
 * silently omitting the keyboard leaves a builder inheriting a promise nobody has tried. It is
 * the one part of this screen where trying it is the only way to find out the wrap is natural.
 */
function moveFocus(event: KeyboardEvent, step: 1 | -1): void {
	const region = event.currentTarget as HTMLElement;
	const stops = [...region.querySelectorAll<HTMLElement>('button')]
		.filter((el) => el.offsetParent !== null);
	const here = stops.indexOf(document.activeElement as HTMLElement);
	if (here === -1) return;
	const next = stops[here + step];
	if (next === undefined) return;
	event.preventDefault();
	next.focus();
}

function toggle(category: string): void {
	const next = new Set(expanded.value);
	if (!next.delete(category)) next.add(category);
	expanded.value = next;
}
</script>

<template>
	<div
		class="rp-al"
		:class="{ 'rp-al--inspecting': inspecting }"
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
			<div
				class="rp-al-shelves"
				@keydown.down="moveFocus($event, 1)"
				@keydown.up="moveFocus($event, -1)"
			>
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
					:collapsible="false"
					:selected-id="selectedId"
					:show-category="true"
					@select="select($event)"
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
					v-for="category in (searching ? [] : shelves)"
					:key="category"
					:label="category"
					:assets="shelfOf(category)"
					:expanded="expanded.has(category)"
					:selected-id="selectedId"
					@toggle="toggle(category)"
					@select="select($event)"
				/>
			</div>

			<AssetInspector
				:asset="selected"
				:withdraw="!inspecting"
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
 * it fill the pane and the half that withdraws it; this is the half that gets the shelves out of
 * its way, and they are separate because a scoped rule may not reach into a composed component's
 * markup — `prototype-styles.test.ts`'s rule, and also just how Vue's scoping works.
 *
 * `withdraw` is the third state that pairing needs. Searching clears `rp-al--inspecting`, which
 * brings the shelves back — and the inspector went on rendering beside them, because it only
 * withdrew when it had no asset at all. So a narrow search drew both panes at once, which is the
 * opposite of what §6.1 promises. Reported by a review bot; the selection is kept rather than
 * cleared, so clearing the field restores the panel the user was reading.
 */
@container rp-al (width < 35rem) {
	.rp-al--inspecting .rp-al-shelves {
		display: none;
	}
}
</style>
