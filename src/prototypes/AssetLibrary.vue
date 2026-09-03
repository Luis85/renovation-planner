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
import { computed, nextTick, ref, watch } from 'vue';
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
/*
 * A collator built from the RESOLVED language, not a bare `localeCompare()`, which sorts in the
 * environment's locale rather than the UI's — and the two differ for exactly the reader this
 * plugin ships a `de.ts` for: a German UI running on a Swedish system would place `ä` after `z`.
 * §§3.2 and 6.1 say "locale-aware under the resolved language" and the first fix delivered only
 * the first half. Reported by a review bot.
 *
 * `LANGUAGE` is a constant here because the harness's `obsidian` mock always answers `'en'` from
 * `getLanguage()`, so a mock reading it would be asserting a fact the harness cannot vary. A
 * promoted component takes the resolved language the way every other translated surface does.
 */
const LANGUAGE = 'en';
const collator = new Intl.Collator(LANGUAGE);
const byName = ASSETS.toSorted((a, b) => collator.compare(a.name, b.name));

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
 * **The third round was the one that says what the real defect was.** Round four keyed the
 * withdrawal on "has the user picked something since the query last changed", which reads
 * correctly and is a fact about an EVENT rather than about a state — so clearing the field was a
 * query change like any other and left a selected asset stranded behind the list, under a
 * comment in this very block promising that clearing restores the panel the user was reading.
 * Three rounds on one mechanism, each patching the previous patch's boolean.
 *
 * The root cause was never any of the three conditions. It was that the flag's name described
 * how it got set instead of what it means. `showSelection` is the question the narrow
 * composition actually asks — *is this pane showing the selection, or the list* — and every
 * transition then reads off it in one line each: typing shows the list, emptying the field shows
 * the selection, picking a row shows it. The shelves hide when it is showing the selection, the
 * inspector withdraws when it is not, and `Back to library` returns to the results rather than
 * clearing the field.
 */
const showSelection = ref(true);
const inspecting = computed(() => selectedId.value !== null && showSelection.value);

/*
 * ONE line, and it is the whole state machine. Typing anything shows the list, because you are
 * looking for something; emptying the field shows the selection again, because you have stopped.
 * Selecting a row (below) shows it too. `inspecting` then gates on there BEING a selection, so
 * clearing an empty-handed search stays on the list without a special case.
 */
watch(query, (now) => { showSelection.value = now.trim() === ''; });

const shelvesEl = ref<HTMLElement | null>(null);
const bodyEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);

/**
 * MOVE FOCUS WHEN THE PANE SWAPS, and only then.
 *
 * Below 35rem the shelves are hidden outright, so the row the user just activated sits inside a
 * `display: none` subtree: focus lands on a hidden element or resets to the document, the change
 * is announced to nobody, and the next Tab starts from the top of the pane. Reported by a review
 * bot, and invisible to every instrument here — jsdom lays nothing out and a capture has no
 * focus in it.
 *
 * **Whether the swap happened is asked of the DOM rather than of a breakpoint.** `matchMedia` is
 * the wrong instrument: §7's ladder is a CONTAINER query, so it answers about the PANE's width
 * and a split leaf's viewport can be much wider. `offsetParent === null` is the browser's own
 * answer to "is this laid out", which is exactly the question.
 *
 * **WHICH MOMENT it is asked at differs by direction, and asking it at one moment for both was
 * the previous version's defect.** The narrow layout is the one that hides the SHELVES, so that
 * is the only element whose visibility answers — and it is hidden at opposite ends of the two
 * gestures. Opening an asset hides them, so the forward swap is visible only AFTER the render;
 * Back reveals them, so by the time the same check ran it read "the shelves are laid out" and
 * returned, every time, in every layout. True, and it is the swap having already happened: the
 * row the user came from was never focused, which is precisely the promise this function exists
 * to keep. So the answer is passed IN, and `back` takes it before it mutates anything.
 *
 * Reported by a review bot, one round after the guard it is correcting was added for the other
 * direction — the shape this repository already has a name for: a fix written against the case
 * in front of its author reads exactly like a fix for the class.
 */
async function focusAfterSwap(selector: string, swapped: () => boolean): Promise<void> {
	await nextTick();
	if (!swapped()) return;
	const target = bodyEl.value?.querySelector<HTMLElement>(selector) ?? null;
	// A target inside a COLLAPSED shelf is in the DOM and not laid out — `v-show`, not `v-if` —
	// and `focus()` on it silently does nothing, stranding the user on `<body>` with the
	// inspector gone too. The search field is the fallback rather than a shelf header: it is the
	// one control present in every state this function can run in.
	if (target !== null && target.offsetParent !== null) target.focus();
	// A REF, not a query from `bodyEl`: the search input lives in the toolbar, which is
	// `.rp-al-body`'s SIBLING — so the first spelling of this fallback searched a subtree that
	// cannot contain its target and returned `null` every time. It was written as the last link
	// of an ordered chain and was unreachable from the day it shipped; reported by a review bot
	// one round after that chain was described here as paying out. A ref cannot be scoped wrong,
	// and it does not go stale against a class rename either.
	else searchEl.value?.focus();
}

/** The narrow layout is the one that withdraws the shelves. Only true while they are withdrawn. */
function shelvesWithdrawn(): boolean {
	return shelvesEl.value !== null && shelvesEl.value.offsetParent === null;
}

function select(id: string): void {
	const swappingIn = !inspecting.value;
	selectedId.value = id;
	showSelection.value = true;
	if (swappingIn) void focusAfterSwap('.rp-al-inspector__back', shelvesWithdrawn);
}

/**
 * Clearing the search from the FIELD. Clears, and moves nothing.
 *
 * **These are two gestures and they were one function, on a premise that was false.** The old
 * docblock argued that below 35rem clearing "hides the shelves — including the input the user is
 * typing in", so Escape had to hand focus on. The input is not in the shelves: the toolbar is
 * their SIBLING (`.rp-al-toolbar`, beside `.rp-al-shelves`), and the narrow rule hid
 * `.rp-al--inspecting .rp-al-shelves` and nothing else — that rule and its flag are both gone
 * from this file now (the closing paragraph of this file's own style block says why), which
 * changes none of the reasoning: the toolbar was never inside the shelves under any
 * composition. The field the user pressed Escape in stays laid out in every layout, so there is
 * nothing to hand focus away from, and the move was
 * a key doing something it never promised — on a narrow pane with a retained selection, Escape
 * cleared the query and sent the user to the inspector's Back button.
 *
 * Two rounds of review found this one gesture at a time: first with an already-empty query,
 * where nothing changed at all, then with a real one, where the clearing is right and the
 * handoff still is not. The guard added for the first case was a fix for the case in the report
 * rather than for the class — this repository's oldest recurring shape — and splitting the
 * function is what actually answers both.
 */
function clearSearch(): void {
	query.value = '';
}

/**
 * Clearing the search from the no-matches BUTTON, which is a different gesture.
 *
 * `Clear search` lives INSIDE the no-matches state, so clearing removes the very control the
 * user pressed and focus falls to the document in every layout. That is why this path moves
 * focus and the field's path does not: here the focused element really does stop existing.
 * Where it lands needs no branch — clearing restores `showSelection`, so on a narrow pane with
 * a selection still held the inspector swaps back IN and its Back control is the honest
 * destination; anywhere else that control is not laid out and `focusAfterSwap`'s own fallback
 * takes the search field.
 */
function clearSearchFromNoMatches(): void {
	query.value = '';
	void focusAfterSwap('.rp-al-inspector__back', () => true);
}

/** One shelf's expansion, flipped. Declared above `back`, which reveals a collapsed shelf. */
function toggle(category: string): void {
	const next = new Set(expanded.value);
	if (!next.delete(category)) next.add(category);
	expanded.value = next;
}

/**
 * The mirror: leaving the inspector returns focus to the row it was opened from — and REVEALS
 * that row, because a selection can outlive its shelf being open.
 *
 * Shelf expansion is per shelf and the selection is restored from the view's own state, so a
 * narrow leaf reopened on a selected asset whose category is collapsed had a row that was in the
 * DOM and hidden (`v-show`). Returning focus to it therefore focused nothing at all, with the
 * inspector already withdrawn — the stranding this pair exists to prevent, arriving through the
 * one path where the DESTINATION is hidden rather than the origin. Expanding is the honest
 * reading of *return the user to where they came from*: a fallback alone leaves the row they
 * were just looking at still out of sight. Reported by a review bot.
 */
function back(): void {
	const leaving = selectedId.value;
	const swappingOut = shelvesWithdrawn();
	// Only when the shelves are what the user is going BACK to. While a search is running the
	// row is drawn in the flat Results list whatever its shelf is doing, so expanding here would
	// silently rewrite an expansion state the user set — visible only later, when they clear the
	// search and find a category open that they had closed. §6.1 says that state is theirs.
	const category = searching.value ? undefined : ASSETS.find((a) => a.id === leaving)?.category;
	if (category !== undefined && !expanded.value.has(category)) toggle(category);
	selectedId.value = null;
	// `CSS.escape`: an asset id is `z.string().min(1)` in the frontmatter schema, so a
	// hand-authored one holding a quote or a backslash builds an invalid selector and
	// `querySelector` THROWS rather than missing. Generated ULIDs are safe; a note somebody
	// typed is not, and this surface exists to show the notes people typed.
	if (leaving !== null) void focusAfterSwap(`[data-asset-id="${CSS.escape(leaving)}"]`, () => swappingOut);
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
		// The RESOLVED language's collator, the same one the rows are sorted by — a bare
		// `localeCompare()` orders by the environment's locale, so a German UI on a Swedish
		// system would sort these shelf names by one rule and the rows inside them by another.
		.toSorted((a, b) => collator.compare(a, b));
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
</script>

<template>
	<div class="rp-al">
		<h2 class="rp-al-title">
			Asset library
		</h2>
		<div class="rp-al-toolbar">
			<label class="rp-al-search">
				<span class="rp-al-search__label">Search the library</span>
				<input
					ref="searchEl"
					v-model="query"
					type="search"
					class="rp-al-search__input"
					placeholder="Name, supplier or SKU"
					@keydown.esc="clearSearch"
				>
			</label>
			<button
				type="button"
				class="rp-al-create"
			>
				New asset
			</button>
		</div>

		<div
			ref="bodyEl"
			class="rp-al-body"
		>
			<div
				ref="shelvesEl"
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
						@click="clearSearchFromNoMatches"
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
				@back="back()"
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

/*
 * §9's own heading, §3.6's toolbar and status bar, and the shelves container are PROMOTED now
 * (design "Asset library overview" Task 13, `src/presentation/library/AssetLibraryRoot.vue`
 * and `AssetShelves.vue`) — the classes below (`rp-al-title`, `rp-al-toolbar`, `rp-al-search*`,
 * `rp-al-create`, `rp-al-body`, `rp-al-shelves`, `rp-al-results`, `rp-al-status*`) stay in this
 * file's TEMPLATE, which is legitimate (`prototype-styles.test.ts`'s own rule: "a mock may name
 * a real component's class in its markup"), but their RULES moved out: a real component now
 * draws with every one of them, and a rule kept here would be a second, drifting source of
 * truth for a class this mock no longer owns the look of. `styles/asset-library.css` is where
 * they live, as of this task rather than of Task 15 — so this prototype renders those regions
 * with the SHIPPED rules in the harness (`tests/harness/index.html` links `/styles.css`, the
 * assembled sheet), which is what criterion 5 asks for: a mock lays a promoted region out using
 * the real sheet rather than its own approximation of it. An earlier draft of this paragraph
 * said the regions render "unstyled" here; that was true only in the window between the classes
 * being promoted and their rules landing, and it never was after the same commit did both.
 *
 * ONE promoted class did not stay in this template: `.rp-al--inspecting` was removed from the
 * root element, because `prototype-styles.test.ts` refuses a prototype DECLARING a class a real
 * component uses and the rule it drove (`.rp-al--inspecting .rp-al-shelves`) names
 * `.rp-al-shelves`. The deletion is right and gate-forced; the consequence is that §7's narrow
 * composition — the "one pane at a time" behaviour the 460px capture found — is demonstrated by
 * NOTHING until Task 16 builds it in `AssetLibraryRoot.vue`. Said here rather than smoothed
 * over, because a capability that quietly stops being shown is one nobody schedules.
 */

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

/* `.rp-al-nothing__action` alone now — its sibling half of this selector,
   `.rp-al-toolbar .rp-al-create:focus-visible`, named a class that is promoted and moved out
   with the rest above. */
.rp-al-nothing .rp-al-nothing__action:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}

/*
 * Below 35rem there is one pane at a time in the PROMOTED narrow composition too (§7, Task 16's
 * to build in `AssetLibraryRoot.vue`) — the rule that hid `.rp-al-shelves` there moved out with
 * every other promoted class above, for the identical reason.
 *
 * `.rp-al--inspecting` is GONE from this file entirely, and this paragraph described it as a
 * "remaining flag" for a commit after the template stopped setting it. There is no narrow
 * composition demonstrated anywhere now — not here, and not in the shipped root until Task 16.
 * That is the honest state and it is a LOSS rather than a neutral tidy-up: the behaviour was
 * visible in a capture and is now visible nowhere.
 */
</style>
