<script setup lang="ts">
/**
 * The Vue root of the Asset library view — one isolated app per Obsidian `ItemView` (ADR-004,
 * SDD §12), exactly as `ViewRoot.vue` and `AssetDesignerRoot.vue` are for their own surfaces.
 *
 * This task (13) fills in Task 11's minimal placeholder with real content: the toolbar (one
 * search field bound straight to `AssetLibraryStore.query`, and `New asset`), the shelves
 * region (`AssetShelves.vue`, or one of §4's two `EmptyState` entries in its place, or the
 * `.rp-view-notice` repair strip drawn ABOVE it), the status bar, and every state §4 tabulates.
 *
 * **The two data attributes Task 11 built this file to prove stay exactly where they were.**
 * `data-selected-asset-id`/`data-expanded-categories` on the ROOT element are what
 * `assetLibraryView.test.ts` reads to assert the in-place-update mechanism (§6.3: a selection
 * or an expansion changes what is drawn without the view remounting the tree).
 *
 * **What is DRAWN follows them, and the first version of this file did not.** `selectedId` and
 * `expandedCategories` below are seeded from the context pair at setup AND kept in step with it
 * by two `watch`es, because for one review round they were a second, desynchronised copy: a leaf
 * restored carrying a selection published `data-selected-asset-id` and marked no row, and a
 * `setState` on an open leaf moved `data-expanded-categories` while every shelf stayed
 * `aria-expanded="false"`. Task 11's proof then certified a mechanism this surface no longer
 * honoured, which is worse than an untested gap because the test still passed. Both directions
 * are pinned by `assetLibraryRoot.test.ts`'s *follows the view state* cases.
 *
 * The refs are still LOCAL rather than the context's own, because the context's are
 * `DeepReadonly<Ref<T>>` by deliberate design (`assetLibraryContext.test-d.ts` proves a write
 * through them is a compile error) — so this file reads them and cannot write them. The
 * remaining half, a WRITE back into Obsidian's view state so a selection made here survives a
 * leaf reopen, is genuinely outside this file and is recorded in this task's report with the
 * route it should take.
 *
 * **Four shell regions** (§3, "the Asset designer's count rather than the Plan editor's five"):
 * toolbar, shelves, inspector, status. The INSPECTOR is Task 14's (`AssetInspector.vue`) and
 * Task 16's to wire in here — this file draws the other three, plus every one of §4's states,
 * which is this task's own stated scope.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one, because Obsidian's
 * marketplace rejects inline styles and this plugin's CSS lives in `styles/`, assembled into
 * one sheet. `.renovation-asset-library` (`styles/asset-library.css`) is this file's one entry
 * point into it; Task 15 is what actually STYLES the classes this file emits.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import DialogHost from '../dialogs/DialogHost.vue';
import EmptyState from '../components/EmptyState.vue';
import ViewFailure from '../components/ViewFailure.vue';
import NewAssetForm from '../views/NewAssetForm.vue';
import AssetShelves from './AssetShelves.vue';
import UnreadableStrip from './UnreadableStrip.vue';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { useAssetLibraryStore } from '../stores/AssetLibraryStore';
import { useDialogStore } from '../dialogs/dialog-store';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../application/commands/asset/SetAssetFootprint';
import type { AssetId } from '../../domain/asset/AssetId';

const context = useAssetLibraryContext();
const store = useAssetLibraryStore();
const dialogs = useDialogStore();

/**
 * The ONE read this view has, on every occasion it runs — open, a retry, and every `catalogue`
 * arm `applyChange` below decides needs one. A second "refresh" path would be a second answer
 * to what this pane is showing, exactly as `PlanEditorRoot` and `ViewRoot` each state about
 * their own `hydrate`.
 */
function hydrate(): Promise<void> {
	return store.hydrate(context.queries, context.indexScanCompleted);
}

/**
 * Registered at setup and disposed on unmount, the same shape and for the same reason
 * `ViewRoot`'s `onProjectsChanged` subscription already carries: Obsidian reuses this view, so
 * a listener outliving its Vue app would re-hydrate a store nothing renders and stack another
 * on the next open.
 *
 * `applyChange` rather than a blanket re-`hydrate()`: the store's own arm decides which of
 * `catalogue`/`marks` actually need the work, so a `design`-only or `usage`-only change this
 * store does not itself hold state for costs nothing here.
 */
onMounted(() => {
	void hydrate();
});
onBeforeUnmount(
	context.onLibraryChanged((change) => {
		void store.applyChange(change, context.queries, context.indexScanCompleted);
	}),
);

/**
 * The whole in-place failure state, or `null` when there is nothing to fail about —
 * `ViewRoot.failure`'s identical shape, ported rather than shared: the two are siblings
 * (§2, "a sibling of that whole ladder rather than a state inside it"), and the headline key
 * differs (`view.asset-library.failed.headline`).
 *
 * The retry is withheld from a bootstrap failure for the identical reason: `surfaceFor`
 * answers `session-failure` for a session that composed no query services at all, and
 * re-running a query that was never wired would be the live-control-that-does-nothing slice
 * 14's own amendment refuses.
 */
const failure = computed(() => {
	const cause = store.error;
	if (cause === null) return null;
	const session = surfaceFor(cause, viewHydrationOrigin(cause)).kind === 'session-failure';
	return {
		headline: tr(session ? 'view.session-failure.headline' : 'view.asset-library.failed.headline'),
		body: trError(cause),
		...(session ? {} : { actionLabel: tr('view.failure.retry') }),
	};
});

/**
 * §3.1's `New asset` — `ViewRoot.onCreateAsset`'s identical sequence, over the SAME
 * `NewAssetForm` and the guarded `createAsset`/`setAssetFootprintFromDimensions` pair this
 * task widened `AssetLibraryCommandServices` to carry (see this task's own report). It does
 * NOT re-hydrate on success, unlike `ViewRoot.onCreateProject`: `AssetCreated` already reaches
 * `catalogue: true` on `AssetLibraryChange` (`assetLibraryChangeSource.ts`), so the
 * `onLibraryChanged` subscription above re-reads the listing on its own — a second explicit
 * read here would be a second answer to what refreshed this list. Opening the designer on what
 * it made mirrors `ViewRoot.onCreateAsset`'s own hand-off, since a freshly created catalogue
 * entry has no shape yet.
 */
const newAssetBusy = ref(false);

async function onCreateAsset(): Promise<void> {
	if (dialogs.current !== null) return;

	const result = await dialogs.openDialog({
		kind: 'form',
		title: tr('form.new-asset.title'),
		component: NewAssetForm,
		props: {
			createAsset: (input: CreateAssetInput) => context.commands.createAsset.execute(input),
			setFootprintFromDimensions: (input: SetAssetFootprintFromDimensionsInput) =>
				context.commands.setAssetFootprintFromDimensions.execute(input),
			busy: newAssetBusy,
			logger: context.logger,
			defaultCurrency: context.commands.defaultCurrency,
		},
		busy: newAssetBusy,
	});
	if (result === 'cancel') return;
	await context.openDesigner(result.values as AssetId);
}

/**
 * `null` for a normal render, or the resolved props for whichever of §4's two action-bearing
 * keys `AssetLibraryStore.emptyStateKey` answers. That getter is already guarded on
 * `status === 'ready'` and already refuses unconditionally on `unreadable.length > 0` — this
 * component adds no second policy on top of it.
 */
/**
 * §6.1's announcement, and `''` when nothing is being searched for.
 *
 * The `<p role="status">` it feeds is drawn UNCONDITIONALLY, which is design slice 13's own
 * finding applied here rather than rediscovered: a live region attributed on a container that
 * APPEARS is announced by nothing, because the region and its first content arrive together.
 * The region is present and empty from the ready branch's first paint and is written into on
 * each keystroke, which is the shape that actually speaks. It also costs one template branch
 * LESS than the `v-if` it replaces, which this template — at fallow's cognitive threshold
 * exactly — has no room to spend.
 */
const matchCount = computed(() =>
	store.searching
		? tr('view.asset-library.search.results', { count: String(store.visibleEntries.length) })
		: '',
);

/**
 * §3.6's `54 assets`, and `''` until the read has actually answered.
 *
 * The status bar stays drawn during loading (§4 keeps the SHELL), and for one review round it
 * drew `0 assets` while the read was in flight — `total` is `entries.length`, so an empty store
 * asserts an empty library. A count is a claim, and there is no true one to make yet; the region
 * holds its place and says nothing rather than saying something false. Resolved here rather than
 * with a `v-if` in the template for the headroom reason above, and with no new locale key: §8's
 * inventory is pinned at 60.
 */
const assetCount = computed(() =>
	store.status === 'ready' ? tr('view.asset-library.assets', { count: String(store.total) }) : '',
);

const empty = computed(() => {
	const key = store.emptyStateKey;
	return key === null ? null : resolveEmptyState(EMPTY_STATE_CONTENT.assetLibrary[key]);
});

/**
 * `noAssets`'s action CREATES something (`New asset`, the same toolbar gesture); `noMatches`'s
 * RESTORES the previous view by clearing the query — a create action offered from a no-matches
 * state would be the wrong gesture, per §4's own table.
 */
function onEmptyStateAction(): void {
	if (store.emptyStateKey === 'noAssets') void onCreateAsset();
	else store.query = '';
}

/**
 * The strip's per-row action. `'missing'` means the listing this row was drawn from is stale —
 * the note the path named is gone — so this is the one strip row that re-reads, mirroring
 * `ProjectDetailState.onOpenNote`'s identical rule for its own repair action. `'failed'` is not
 * a stale row: the composition root has already put a notice in front of the user for it.
 */
async function onOpenNoteRow(path: string): Promise<void> {
	if ((await context.openNote(path)) === 'missing') await hydrate();
}

/** §6.3's own sentinel: `context.assetId` is `''` for "nothing selected", never `null`, and
 *  `AssetRow`'s `selected` prop compares against an id — so the two vocabularies meet here and
 *  in exactly one place. */
function selectionOf(assetId: string): AssetId | null {
	return assetId === '' ? null : (assetId as AssetId);
}

/**
 * The shelves' own selection and expansion — held HERE rather than inside `AssetShelves.vue`
 * for `AssetShelves.vue`'s own reason: a search that briefly matches nothing swaps the shelves
 * region for an `EmptyState`, unmounting `AssetShelves` entirely, and a value only that
 * component held would reset with it — exactly the loss §6.1's "a search must not cost a user
 * the arrangement they had" refuses. A value the parent holds survives that swap.
 *
 * SEEDED from the context at setup and WATCHED after it, which is §6.3's whole mechanism: the
 * view state is what a restored leaf and every `setState` speak through, so it is the authority
 * and this pair follows it. The watches are not deep — `setState` REPLACES both refs — and they
 * overwrite whatever the user last toggled, which is correct while nothing writes back: a state
 * change arriving from outside is newer than a local gesture, and the alternative (ignoring it)
 * is the desynchronisation these two lines exist to close.
 */
const expandedCategories = ref<ReadonlySet<string>>(new Set(context.expanded.value));
const selectedId = ref<AssetId | null>(selectionOf(context.assetId.value));

watch(context.assetId, (assetId) => {
	selectedId.value = selectionOf(assetId);
});
watch(context.expanded, (categories) => {
	expandedCategories.value = new Set(categories);
});

function toggleShelf(category: string): void {
	const next = new Set(expandedCategories.value);
	if (!next.delete(category)) next.add(category);
	expandedCategories.value = next;
}

function onSelect(assetId: AssetId): void {
	selectedId.value = assetId;
}
</script>

<template>
	<div
		class="renovation-asset-library"
		:data-selected-asset-id="context.assetId.value"
		:data-expanded-categories="context.expanded.value.join(',')"
	>
		<h2 class="rp-al-title">
			{{ tr('view.asset-library.title') }}
		</h2>
		<ViewFailure
			v-if="failure !== null"
			v-bind="failure"
			@action="() => void hydrate()"
		/>
		<template v-else>
			<div class="rp-al-toolbar">
				<label class="rp-al-search">
					<span class="rp-al-search__label">{{ tr('view.asset-library.search.label') }}</span>
					<input
						v-model="store.query"
						type="search"
						class="rp-al-search__input"
						:placeholder="tr('view.asset-library.search.placeholder')"
						@keydown.esc="store.query = ''"
					>
				</label>
				<button
					type="button"
					class="rp-al-create"
					@click="onCreateAsset"
				>
					{{ tr('view.asset-library.new-asset') }}
				</button>
			</div>
			<div class="rp-al-body">
				<div
					v-if="store.status !== 'ready'"
					class="rp-view-message"
				>
					<p>{{ tr('view.asset-library.loading') }}</p>
				</div>
				<template v-else>
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
						v-else
						:entries="store.visibleEntries"
						:searching="store.searching"
						:expanded="expandedCategories"
						:selected-id="selectedId"
						@toggle="toggleShelf"
						@select="onSelect"
					/>
				</template>
			</div>
			<footer class="rp-al-status">
				<span class="rp-al-status__count">{{ assetCount }}</span>
				<span class="rp-al-status__sep" />
				<span class="rp-al-status__folder">{{ context.libraryFolder }}</span>
			</footer>
		</template>
		<DialogHost />
	</div>
</template>
