<script setup lang="ts">
/**
 * The Asset library's SHELVES REGION once the catalogue read has answered: §6.1's live-region
 * announcement, §5.1a's repair strip, either of §4's two `EmptyState` entries, and the shelves
 * themselves.
 *
 * **§4's LOADING line is deliberately not here**, and it was for one commit. §7's narrow
 * composition hides this element outright once something is selected, so a restored leaf below
 * 35rem drew nothing at all between its toolbar and its status bar for the length of the read —
 * strictly worse than the *"never a spinner over an empty pane"* §4 forbids. The line lives in
 * `AssetLibraryRoot.vue`'s `.rp-al-main`, outside the element the container query hides, and
 * this component is drawn only from the ready branch beside it.
 *
 * **Extracted out of `AssetLibraryRoot.vue` by Task 16a, and the extraction is the point rather
 * than a tidy-up.** Task 13's own review named it, and this task's brief measured why: the root
 * stood at 331 lines against a 400 cap with a cognitive complexity of 12 against fallow's 15,
 * and a conditional region at the toolbar/body/footer sibling position — exactly where §3's
 * fourth shell region, the inspector, goes — costs THREE. Mounting the inspector therefore spent
 * the whole remaining budget on its own, and this file is what buys the room back. An
 * over-complex template is a seam nobody has drawn yet: the root owns the SHELL, the doors and
 * §6.3's view state; this file owns what the shelves region draws.
 *
 * **`.rp-al-body` is this component's root element and stays exactly where it was**, because
 * §7's narrow composition keys on it — `styles/asset-library.css` hides
 * `.renovation-asset-library[data-selected-asset-id]:not([data-selected-asset-id='']) .rp-al-body`
 * inside `@container rp-al (width < 35rem)`, a descendant selector written (in its own words) so
 * that it "holds regardless of how deep Task 16 nests `.rp-al-body`". Nesting it one level
 * deeper inside `.rp-al-main` is exactly the case that comment anticipated.
 *
 * **It also owns §5.3's mark BATCH, which is the one thing here that is not markup.** The
 * shelves are what draw the rows, so this component is what knows which rows are drawn — see
 * `drawnAssetIds` below for the batch, and for the honest narrowing of §5.3's *viewport* to
 * *what an open shelf draws*. Task 17b added both; before it, `<AssetShelves>` was mounted with
 * no `outline-for` at all and every mark in the catalogue drew §3.4's *not yet read* for the
 * life of the view.
 *
 * **Neither `expanded` nor `selectedId` is held here**, for the reason `AssetShelves.vue`'s own
 * header already gives one level down: a search that briefly matches nothing swaps this whole
 * region for an `EmptyState`, and a value only this component held would reset with it —
 * the loss §6.1's "a search must not cost a user the arrangement they had" refuses. The root
 * holds both and publishes them; this file draws them.
 *
 * **`rehydrate` is an EMIT rather than a `store.hydrate` call of its own**, because
 * `onOpenNoteRow` below IS the root's own function moved out for a budget, over the same
 * `context.openNote` door the shell already had — so a call here would be a second spelling of
 * one line rather than a second door. `AssetLibraryRoot.hydrate`'s own docblock carries the
 * measured count of that store's call sites across this folder, and why the inspector's two are
 * not a copy of it.
 *
 * No `<style>` block, ever (`vue/no-restricted-block`): every class here is already declared in
 * `styles/asset-library.css`.
 */
import { computed, ref, watch } from 'vue';
import EmptyState from '../components/EmptyState.vue';
import AssetShelves from './AssetShelves.vue';
import AssetGrid from './AssetGrid.vue';
import UnreadableStrip from './UnreadableStrip.vue';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { useAssetLibraryStore } from '../stores/AssetLibraryStore';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { tr } from '../i18n/strings';
import type { AssetId } from '../../domain/asset/AssetId';
import type { CatalogueEntryDto } from '../../application/queries/ListCatalogueEntries';
import type { LibraryLayout } from './libraryBrowse';
import { categoryLabel } from './shelfList';

const props = defineProps<{
	/** Which shelf categories are open — the ROOT's, per this file's own header. */
	expanded: ReadonlySet<string>;
	/** §6.3's `''` sentinel already resolved to an id or `null` by the root. */
	selectedId: AssetId | null;
	/** AD18-R18's `Grid | List`, the root's for the same reason `expanded` is. */
	layout: LibraryLayout;
	/** AD18-R18's sidebar filter, `''` for every category — the root's, likewise. */
	category: string;
}>();

const emit = defineEmits<{
	toggle: [category: string];
	select: [assetId: AssetId];
	/** §3.1's `New asset`, which opens a dialog and therefore belongs to the root. */
	create: [];
	/** §4's other empty-state action — see `onEmptyStateAction` for why it leaves this file. */
	'clear-search': [];
	/** AD18-R18's filtered-to-nothing state clears the category filter, which the root owns. */
	'clear-filter': [];
	/** The listing this pane was drawn from is stale — see this file's own header. */
	rehydrate: [];
}>();

const context = useAssetLibraryContext();
const store = useAssetLibraryStore();

/**
 * What is DRAWN: the search's matches narrowed to the sidebar's category (AD18-R18). The count
 * below, the empty state and the mark batch all read this, so none of them speaks about a set
 * the pane is not showing.
 */
const inCategory = computed((): readonly CatalogueEntryDto[] =>
	props.category === '' ? store.visibleEntries : store.visibleEntries.filter((entry) => entry.category === props.category),
);

/**
 * §6.1's announcement, and `''` when nothing is being searched for.
 *
 * The `<p role="status">` it feeds is drawn UNCONDITIONALLY, which is design slice 13's own
 * finding applied here rather than rediscovered: a live region attributed on a container that
 * APPEARS is announced by nothing, because the region and its first content arrive together.
 * The region is present and empty from the ready branch's first paint and is written into on
 * each keystroke, which is the shape that actually speaks.
 */
const matchCount = computed(() =>
	store.searching
		? tr('view.asset-library.search.results', { count: String(inCategory.value.length) })
		: '',
);

/**
 * AD18-R18's third empty state: the catalogue has assets (and, while searching, matches), and the
 * category filter leaves none of them drawn. The store's key cannot know the filter, which is the
 * root's view state, so this is decided here, after the store has had its say. It names the
 * category, and its action clears the filter rather than the search, because the filter is what
 * emptied the pane.
 */
const filteredEmpty = computed(() => {
	if (props.category === '' || inCategory.value.length > 0) return null;
	const category = categoryLabel(props.category);
	return {
		headline: tr(store.searching ? 'view.asset-library.filtered.no-matches' : 'view.asset-library.filtered.none', { category }),
		body: tr('view.asset-library.filtered.body'),
		actionLabel: tr('view.asset-library.filtered.action'),
	};
});

/**
 * `null` for a normal render, or the resolved props for whichever of §4's two action-bearing
 * keys `AssetLibraryStore.emptyStateKey` answers. That getter is already guarded on
 * `status === 'ready'` and already refuses unconditionally on `unreadable.length > 0` — this
 * component adds no second policy on top of it. Only when it answers `null` does AD18-R18's
 * filtered state above get a say.
 */
const empty = computed(() => {
	const key = store.emptyStateKey;
	if (key !== null) return resolveEmptyState(EMPTY_STATE_CONTENT.assetLibrary[key]);
	return filteredEmpty.value;
});

/**
 * `noAssets`'s action CREATES something (`New asset`, the same toolbar gesture the root owns);
 * `noMatches`'s RESTORES the previous view by clearing the query — a create action offered from
 * a no-matches state would be the wrong gesture, per §4's own table.
 *
 * **Both arms EMIT, and the second one did not until a review found the focus gone.** Clearing
 * the query here made `emptyStateKey` null, which removes this whole `EmptyState` — the button
 * the user just pressed — so focus fell to `<body>` and the next Tab restarted at the top of the
 * pane. §12's fifth focus direction is exactly this gesture, and the prototype this component
 * was promoted from splits `clearSearchFromNoMatches` out of `clearSearch` for exactly it. The
 * move belongs to the root, which owns `focusAfterSwap`, the shell element and the search field;
 * what belongs here is knowing WHICH of §4's two states the button was drawn in.
 */
function onEmptyStateAction(): void {
	if (store.emptyStateKey === 'noAssets') emit('create');
	else if (store.emptyStateKey === 'noMatches') emit('clear-search');
	else emit('clear-filter');
}

/**
 * §5.3's mark batch: the ids of the rows this region is DRAWING, handed to the store on every
 * change to that set.
 *
 * **The bound is what an open shelf draws, and §5.3 asks for the VIEWPORT — so the claim is
 * narrowed here rather than left implying a precision this build does not have.** §5.3's rule 1
 * is *"a mark is requested when its row enters the viewport"*, and nothing in this repository
 * observes a viewport: no module in `src/` or `tests/` constructs an `IntersectionObserver`
 * (every occurrence of the name is prose, this paragraph included — which is why that is
 * stated rather than counted), and jsdom implements none, so one would be this tree's first,
 * unexercisable by the suite as it stands, and its correctness would live entirely
 * where no gate here can reach it — the trade CLAUDE.md already records taking the other way
 * (*prefer the fix whose result a gate can see to the one whose correctness lives where no gate
 * reaches*). What ships is a strict SUPERSET of the viewport: every row an open shelf draws, or
 * every match when §6.1's flat Results list has replaced the shelves, or every tile when
 * AD18-R18's Grid view draws them all — each set narrowed to the sidebar's category first.
 *
 * What that costs, exactly, so the next reader does not have to derive it: a shelf holding 34
 * entries reads 34 sidecars to draw the six rows a pane can show — §5.3's own named objection to
 * the per-shelf bound it replaced. What it does NOT cost is either of the two HOLES that
 * objection came with. The `searching` arm is the first: a flat Results list has no expanded
 * shelf at all, so without it every search result would sit in *not yet read* for ever,
 * contradicting §5.3's own rule 2. And rules 2 and 3 are untouched — a row still renders
 * unread and fills in, and nothing in flight is cancelled when a shelf closes.
 *
 * §5.4 inherits the same narrowing through `ViewportMarks.invalidate`, which re-reads exactly
 * the intersection of the invalidated ids with this set: a row in an OPEN shelf re-requests
 * immediately whether or not it is scrolled into view, and a row in a closed one waits for the
 * shelf. That is §5.4's rule with *on screen* read as *drawn*, and it errs towards the eager
 * half, which is the safe direction — a stale outline held for the life of the view is the
 * failure that section exists to prevent.
 *
 * Not derived from the DOM: `AssetShelf` draws a collapsed shelf's rows and hides them with
 * `v-show`, so a query over `.rp-al-row` would name every row in the catalogue. The state is
 * what says which shelf is open, and it is what the shelves are drawn from.
 *
 * **The residual §7 leaves, recorded HERE rather than only in a task report, because a residual
 * a report holds reaches nobody.** *Drawn* is not *visible*. Below 35rem with something
 * selected, `styles/asset-library.css` sets `display: none` on `.rp-al-body` — the rule this
 * file's own header already discusses, since that selector is why this element's position may
 * not move — and this component stays MOUNTED underneath it. So an open shelf's marks are read
 * for rows the pane is not showing at all, which is the narrow composition's own worse case of
 * the 34-sidecar costing above. It is a COST and not a correctness defect: the marks are
 * cached, correct, and already there when the user comes back from the inspector.
 *
 * Closing it means asking whether this region is DISPLAYED, which is a container query — and
 * jsdom evaluates none, so the guard would be unassertable by every gate here — the same trade
 * the `IntersectionObserver` lost in this docblock's opening argument, lost for the same reason.
 *
 * (Both of those pointers counted PARAGRAPHS for one commit and both counts were wrong: three
 * and five, not two and two. A count is right until the next insertion and silently wrong
 * afterwards; a NAME survives every edit that does not delete its subject. Fourteenth instance
 * of this class on the branch, and the second inside a round fixing an instance of it.)
 */
const drawnAssetIds = computed((): readonly AssetId[] =>
	(store.searching || props.layout === 'grid'
		? inCategory.value
		: inCategory.value.filter((entry) => props.expanded.has(entry.category))
	).map((entry) => entry.assetId),
);

/**
 * `watch` and never `watchEffect`, and the difference is MEASURED rather than reasoned:
 * `ViewportMarks.setVisible` READS the mark cache (`marks.value.has`) to decide what is already
 * known, and that cache is a reactive `Map`, so under `watchEffect` the answers it stores are
 * dependencies of the effect that asked for them. Counted, over one shelf holding one asset:
 * `watchEffect` runs TWICE and this `watch` callback runs ONCE, both issuing exactly one
 * `listOutlines`. So the extra pass is real and is harmless TODAY — `read`'s own filter drops
 * an id already cached, so the second pass asks for nothing — which is the point: the effect
 * form is safe only because of a filter one module away, and a `watch` callback is not a
 * tracking context at all, so `drawnAssetIds` is the whole of what re-runs this.
 *
 * `immediate`, because the first paint is already a batch: `AssetLibraryRoot` draws this region
 * only from the ready branch, so the listing has resolved by the time this component exists.
 *
 * Fire-and-forget, and there is nothing to report: `listOutlines` answers a MAP rather than a
 * `Result` and settles per asset, so a batch that could not be read arrives as one `refused`
 * outline per id and draws §3.4's struck box. The refusal is IN the marks, and a fault below
 * the guarded door is mapped to that same per-id refusal by `createAssetLibraryQueries` — so
 * there is no rejection here for a `.catch` to have.
 */
watch(drawnAssetIds, (assetIds) => void store.setVisibleMarks(assetIds, context.queries), {
	immediate: true,
});

/**
 * The strip's per-row action. `'missing'` means the listing this row was drawn from is stale —
 * the note the path named is gone — so this is the one strip row that re-reads, mirroring
 * `ProjectDetailState.onOpenNote`'s identical rule for its own repair action. `'failed'` is not
 * a stale row: the composition root has already put a notice in front of the user for it.
 */
async function onOpenNoteRow(path: string): Promise<void> {
	if ((await context.openNote(path)) === 'missing') emit('rehydrate');
}

const bodyEl = ref<HTMLElement | null>(null);
/** AL10's Back-restores-scroll: the root reads the shelves' current offset through this door. */
function shelvesElement(): HTMLElement | null {
	return bodyEl.value?.querySelector<HTMLElement>('.rp-al-shelves') ?? null;
}
defineExpose({ shelvesElement });
</script>

<template>
	<div
		ref="bodyEl"
		class="rp-al-body"
	>
		<p
			class="rp-al-results"
			role="status"
		>
			{{ matchCount }}
		</p>
		<UnreadableStrip
			v-if="store.unreadable.length > 0"
			:entries="store.unreadable"
			@open="(path) => void onOpenNoteRow(path)"
		/>
		<EmptyState
			v-if="empty !== null"
			v-bind="empty"
			@action="onEmptyStateAction"
		/>
		<AssetShelves
			v-else-if="layout === 'list'"
			:entries="store.visibleEntries"
			:searching="store.searching"
			:expanded="expanded"
			:selected-id="selectedId"
			:outline-for="store.markFor"
			:category="category"
			@toggle="emit('toggle', $event)"
			@select="emit('select', $event)"
		/>
		<AssetGrid
			v-else
			:entries="inCategory"
			:selected-id="selectedId"
			:outline-for="store.markFor"
			@select="emit('select', $event)"
			@create="emit('create')"
		/>
	</div>
</template>
