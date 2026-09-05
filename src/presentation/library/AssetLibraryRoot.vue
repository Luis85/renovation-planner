<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useLibraryDraftGuard } from './libraryDraftGuard';
import DialogHost from '../dialogs/DialogHost.vue';
import ViewFailure from '../components/ViewFailure.vue';
import AssetInspector from './AssetInspector.vue';
import AssetLibraryBody from './AssetLibraryBody.vue';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { focusRowAt, focusWithin, rowPositionOf, shelvesWithdrawn } from './shelfFocus';
import { deleteAssetWithReferences } from './deleteAssetFlow';
import { useAssetLibraryStore } from '../stores/AssetLibraryStore';
import { useDialogStore } from '../dialogs/dialog-store';
import { openNewAssetDialog } from '../views/newAssetDialog';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';
import { surfaceFor, viewHydrationOrigin } from '../errors/errorSurfacePolicy';
import { notifyFault, notifyOperationFailure } from '../notices/notify';
import type { AssetId } from '../../domain/asset/AssetId';

const context = useAssetLibraryContext();
const store = useAssetLibraryStore();
const dialogs = useDialogStore();
const draftGuard = useLibraryDraftGuard();

const shellEl = ref<HTMLElement | null>(null);
const searchEl = ref<HTMLInputElement | null>(null);

function hydrate(): Promise<void> {
	return store.hydrate(context.queries, context.indexScanCompleted);
}

onMounted(() => {
	void hydrate();
});
onBeforeUnmount(
	context.onLibraryChanged((change) => {
		void store.applyChange(change, context.queries, context.indexScanCompleted);
	}),
);

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

const newAssetBusy = ref(false);

const assetCount = computed(() =>
	store.status === 'ready' ? tr('view.asset-library.assets', { count: String(store.total) }) : '',
);

function selectionOf(assetId: string): AssetId | null {
	return assetId === '' ? null : (assetId as AssetId);
}

const expandedCategories = ref<ReadonlySet<string>>(new Set(context.expanded.value));
const selectedId = ref<AssetId | null>(selectionOf(context.assetId.value));

watch(context.expanded, (categories) => {
	expandedCategories.value = new Set(categories);
});

const showingSelection = ref(true);
watch(
	() => store.searching,
	(searching) => {
		showingSelection.value = !searching;
	},
);

const paneAssetId = computed(() => (showingSelection.value ? (selectedId.value ?? '') : ''));

function publish(assetId: AssetId | null, expanded: ReadonlySet<string>): void {
	context.publishViewState(assetId ?? '', [...expanded]);
}

async function focusAfterSwap(selector: string, swapped: () => boolean): Promise<void> {
	await nextTick();
	if (!swapped()) return;
	focusWithin(shellEl.value, selector, searchEl.value);
}

function onClearSearch(): void {
	store.query = '';
	void focusAfterSwap('.rp-al-inspector__back', () => true);
}

function toggleShelf(category: string): void {
	const next = new Set(expandedCategories.value);
	if (!next.delete(category)) next.add(category);
	expandedCategories.value = next;
	publish(selectedId.value, next);
}

function performSelect(assetId: AssetId): void {
	selectedId.value = assetId;
	showingSelection.value = true;
	publish(assetId, expandedCategories.value);
	void focusAfterSwap('.rp-al-inspector__back', () => shelvesWithdrawn(shellEl.value));
}

function onBack(): void {
	const leaving = selectedId.value;
	const swappingOut = shelvesWithdrawn(shellEl.value);
	const category = leaving === null || store.searching ? undefined : store.entryFor(leaving)?.category;
	const expanded = new Set(expandedCategories.value);
	if (category !== undefined) expanded.add(category);
	expandedCategories.value = expanded;
	showingSelection.value = false;
	publish(selectedId.value, expanded);
	if (leaving === null) return;
	void focusAfterSwap(`[data-asset-id="${CSS.escape(leaving)}"]`, () => swappingOut);
}

let deleting = false;

async function deleteSelectedAsset(assetId: AssetId): Promise<void> {
	if (deleting) return;
	deleting = true;
	try {
		const position = rowPositionOf(shellEl.value, assetId);
		const outcome = await deleteAssetWithReferences(
			{ queries: context.queries, deleteAsset: context.commands.deleteAsset, dialogs },
			assetId,
			store.entryFor(assetId)?.name ?? '',
		);
		if (outcome.kind === 'failed') {
			notifyOperationFailure(outcome.error);
			return;
		}
		if (outcome.kind === 'cancelled') return;
		selectedId.value = null;
		showingSelection.value = true;
		publish(null, expandedCategories.value);
		await hydrate();
		await nextTick();
		focusRowAt(position, searchEl.value);
	} catch (cause) {
		notifyFault(cause, context.logger, 'library.deleteAsset.faulted');
	} finally {
		deleting = false;
	}
}

async function createAsset(): Promise<void> {
	if (dialogs.current !== null) return;
	const createdId = await openNewAssetDialog({
		dialogs,
		busy: newAssetBusy,
		commands: context.commands,
		logger: context.logger,
	});
	if (createdId === null) return;
	await hydrate();
	const created = store.entryFor(createdId);
	if (created !== null) {
		store.query = '';
		expandedCategories.value = new Set([...expandedCategories.value, created.category]);
	}
	performSelect(createdId);
}
async function onCreateAsset(): Promise<void> {
	await draftGuard.leave(createAsset);
}
function onSelect(assetId: AssetId): void {
	if (assetId === selectedId.value) { showingSelection.value = true; return; }
	void draftGuard.leave(() => performSelect(assetId));
}
async function onDelete(assetId: AssetId): Promise<void> {
	await draftGuard.leave(() => deleteSelectedAsset(assetId));
}
watch(context.assetId, async (assetId) => {
	if (selectionOf(assetId) === selectedId.value) return;
	await draftGuard.leave(() => { selectedId.value = selectionOf(assetId); showingSelection.value = true; });
	if (selectionOf(context.assetId.value) !== selectedId.value) publish(selectedId.value, expandedCategories.value);
});
</script>

<template>
	<div
		ref="shellEl"
		class="renovation-asset-library"
		:data-selected-asset-id="paneAssetId"
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
		<template v-if="failure === null || store.status === 'ready'">
			<div class="rp-al-toolbar">
				<label class="rp-al-search">
					<span class="rp-al-search__label">{{ tr('view.asset-library.search.label') }}</span>
					<input
						ref="searchEl"
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
			<div class="rp-al-main">
				<div
					v-if="store.status !== 'ready'"
					class="rp-view-message"
				>
					<p>{{ tr('view.asset-library.loading') }}</p>
				</div>
				<template v-else>
					<AssetLibraryBody
						:expanded="expandedCategories"
						:selected-id="selectedId"
						@toggle="toggleShelf"
						@select="onSelect"
						@create="onCreateAsset"
						@clear-search="onClearSearch"
						@rehydrate="() => void hydrate()"
					/>
					<AssetInspector
						:class="{ 'rp-al-inspector--away': !showingSelection }"
						:asset-id="selectedId"
						@back="onBack"
						@delete="(id) => void onDelete(id)"
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
