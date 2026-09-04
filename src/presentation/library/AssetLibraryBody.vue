<script setup lang="ts">
/**
 * The Asset library's SHELVES REGION and every one of §4's states inside it: the loading line,
 * §6.1's live-region announcement, §5.1a's repair strip, either of §4's two `EmptyState` entries,
 * and the shelves themselves.
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
 * **Neither `expanded` nor `selectedId` is held here**, for the reason `AssetShelves.vue`'s own
 * header already gives one level down: a search that briefly matches nothing swaps this whole
 * region for an `EmptyState`, and a value only this component held would reset with it —
 * the loss §6.1's "a search must not cost a user the arrangement they had" refuses. The root
 * holds both and publishes them; this file draws them.
 *
 * **`rehydrate` is an EMIT rather than a `store.hydrate` call of its own.** The root's `hydrate`
 * is "the ONE read this view has, on every occasion it runs", and a second call site here would
 * be a second answer to what refreshed this pane.
 *
 * No `<style>` block, ever (`vue/no-restricted-block`): every class here is already declared in
 * `styles/asset-library.css`.
 */
import { computed } from 'vue';
import EmptyState from '../components/EmptyState.vue';
import AssetShelves from './AssetShelves.vue';
import UnreadableStrip from './UnreadableStrip.vue';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { useAssetLibraryStore } from '../stores/AssetLibraryStore';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { tr } from '../i18n/strings';
import type { AssetId } from '../../domain/asset/AssetId';

defineProps<{
	/** Which shelf categories are open — the ROOT's, per this file's own header. */
	expanded: ReadonlySet<string>;
	/** §6.3's `''` sentinel already resolved to an id or `null` by the root. */
	selectedId: AssetId | null;
}>();

const emit = defineEmits<{
	toggle: [category: string];
	select: [assetId: AssetId];
	/** §3.1's `New asset`, which opens a dialog and therefore belongs to the root. */
	create: [];
	/** The listing this pane was drawn from is stale — see this file's own header. */
	rehydrate: [];
}>();

const context = useAssetLibraryContext();
const store = useAssetLibraryStore();

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
		? tr('view.asset-library.search.results', { count: String(store.visibleEntries.length) })
		: '',
);

/**
 * `null` for a normal render, or the resolved props for whichever of §4's two action-bearing
 * keys `AssetLibraryStore.emptyStateKey` answers. That getter is already guarded on
 * `status === 'ready'` and already refuses unconditionally on `unreadable.length > 0` — this
 * component adds no second policy on top of it.
 */
const empty = computed(() => {
	const key = store.emptyStateKey;
	return key === null ? null : resolveEmptyState(EMPTY_STATE_CONTENT.assetLibrary[key]);
});

/**
 * `noAssets`'s action CREATES something (`New asset`, the same toolbar gesture the root owns);
 * `noMatches`'s RESTORES the previous view by clearing the query — a create action offered from
 * a no-matches state would be the wrong gesture, per §4's own table.
 */
function onEmptyStateAction(): void {
	if (store.emptyStateKey === 'noAssets') emit('create');
	else store.query = '';
}

/**
 * The strip's per-row action. `'missing'` means the listing this row was drawn from is stale —
 * the note the path named is gone — so this is the one strip row that re-reads, mirroring
 * `ProjectDetailState.onOpenNote`'s identical rule for its own repair action. `'failed'` is not
 * a stale row: the composition root has already put a notice in front of the user for it.
 */
async function onOpenNoteRow(path: string): Promise<void> {
	if ((await context.openNote(path)) === 'missing') emit('rehydrate');
}
</script>

<template>
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
				:expanded="expanded"
				:selected-id="selectedId"
				@toggle="emit('toggle', $event)"
				@select="emit('select', $event)"
			/>
		</template>
	</div>
</template>
