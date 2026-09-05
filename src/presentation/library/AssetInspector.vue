<script setup lang="ts">
import { useLibraryDraftGuard } from './libraryDraftGuard';
import { computed, useId, watch } from 'vue';
import type { AssetId } from '../../domain/asset/AssetId';
import { tr } from '../i18n/strings';
import { useAssetLibraryContext } from './AssetLibraryContext';
import { useAssetLibraryStore } from '../stores/AssetLibraryStore';
import { useAssetSelectionStore } from '../stores/AssetSelectionStore';
import AssetInspectorFields from './AssetInspectorFields.vue';
import AssetInspectorShape from './AssetInspectorShape.vue';
import AssetInspectorUsedIn from './AssetInspectorUsedIn.vue';

const props = defineProps<{ assetId: AssetId | null }>();

const emit = defineEmits<{ back: []; delete: [assetId: AssetId] }>();

const context = useAssetLibraryContext();
const draftGuard = useLibraryDraftGuard();
const library = useAssetLibraryStore();
const selection = useAssetSelectionStore();

watch(
	() => props.assetId,
	(assetId) => {
		void selection.select(assetId, context.queries);
	},
	{ immediate: true },
);

const entry = computed(() => (props.assetId === null ? null : library.entryFor(props.assetId)));

const outsideSearch = computed(() => library.searching && !library.visibleEntries.some((row) => row.assetId === props.assetId));

const unreadable = computed(() =>
	props.assetId === null
		? null
		: (library.unreadable.find((row) => row.assetId === props.assetId) ?? null),
);

type PanelState = 'resting' | 'ready' | 'note-unreadable' | 'note-future-schema' | 'gone';

const state = computed((): PanelState => {
	const found = entry.value;
	const row = unreadable.value;
	if (found !== null) return 'ready';
	if (row !== null) {
		return row.code !== null && row.code.endsWith('.schema-version-unsupported')
			? 'note-future-schema'
			: 'note-unreadable';
	}
	return props.assetId === null ? 'resting' : 'gone';
});

const failure = computed((): string => {
	const row = unreadable.value;
	if (row === null) return tr('view.asset-library.asset-gone');
	return state.value === 'note-future-schema'
		? tr('view.asset-library.note-future-schema', { path: row.path })
		: tr('view.asset-library.note-unreadable', { path: row.path });
});

const canOpenDesigner = computed(
	() => state.value === 'ready' && selection.designStatus !== 'failed',
);

const canOpenNote = computed(() => state.value === 'ready' || state.value === 'note-unreadable');

const canDelete = computed(() => state.value === 'ready' && selection.usedInStatus === 'ready');

const deleteReason = computed((): string | null =>
	selection.usedInStatus === 'failed' ? tr('view.asset-library.used-in.failed') : null,
);

const deleteReasonId = useId();
const deleteAttributes = computed(() => ({
	'aria-disabled': canDelete.value ? undefined : 'true' as const,
	'aria-describedby': deleteReason.value === null ? undefined : deleteReasonId,
}));



async function openNote(): Promise<void> {
	const row = unreadable.value;
	if (row !== null) {
		if ((await context.openNote(row.path)) === 'missing') {
			await library.hydrate(context.queries, context.indexScanCompleted);
		}
		return;
	}
	if (props.assetId !== null && (await context.openAssetNote(props.assetId)) === 'missing') {
		await library.hydrate(context.queries, context.indexScanCompleted);
	}
}

function onOpenDesigner(): void {
	const assetId = props.assetId;
	if (assetId !== null) void draftGuard.leave(() => context.openDesigner(assetId));
}

function onDelete(): void {
	if (!canDelete.value || props.assetId === null) return;
	emit('delete', props.assetId);
}
async function onOpenProject(projectId: string): Promise<void> {
	await draftGuard.leave(async () => {
		if ((await context.openProject(projectId)) === 'missing') await selection.refreshUsedIn(context.queries);
	});
}
async function onOpenNote(): Promise<void> {
	await draftGuard.leave(openNote);
}
</script>

<template>
	<aside
		class="rp-al-inspector"
		:class="{ 'rp-al-inspector--rest': state === 'resting' }"
		:data-inspector-state="state"
	>
		<button
			type="button"
			class="rp-al-inspector__back"
			@click="emit('back')"
		>
			{{ tr('view.asset-library.back') }}
		</button>
		<p
			v-if="state === 'resting'"
			class="rp-al-inspector__rest"
		>
			{{ tr('view.asset-library.unselected') }}
		</p>
		<template v-else-if="entry !== null && assetId !== null">
			<h3 class="rp-al-inspector__name">
				{{ entry.name }}
			</h3>
			<p
				v-if="outsideSearch"
				class="rp-al-note"
			>
				{{ tr('view.asset-library.outside-search') }}
			</p>
			<AssetInspectorUsedIn
				:groups="selection.usedIn"
				:overriding="selection.overriding"
				:status="selection.usedInStatus"
				:error="selection.usedInError"
				@open-project="onOpenProject"
			/>
			<button
				v-if="selection.usedInStatus === 'failed'"
				type="button"
				@click="selection.refreshUsedIn(context.queries)"
			>
				{{ tr('view.failure.retry') }}
			</button>
			<AssetInspectorFields
				:key="assetId"
				:entry="entry"
			/>
			<AssetInspectorShape
				:design="selection.design"
				:status="selection.designStatus"
				:error="selection.designError"
				:background="entry.background"
			/>
			<button
				v-if="selection.designStatus === 'failed'"
				type="button"
				@click="selection.refreshDesign(context.queries)"
			>
				{{ tr('view.failure.retry') }}
			</button>
		</template>
		<p
			v-else
			class="rp-al-inspector__failure"
		>
			{{ failure }}
		</p>
		<div class="rp-al-actions">
			<button
				v-if="canOpenDesigner"
				type="button"
				class="rp-al-action rp-al-action--designer"
				@click="onOpenDesigner"
			>
				{{ tr('view.asset-library.open-designer') }}
			</button>
			<button
				v-if="canOpenNote"
				type="button"
				class="rp-al-action rp-al-action--note"
				@click="void onOpenNote()"
			>
				{{ tr('view.asset-library.open-note') }}
			</button>
			<button
				v-if="state === 'ready'"
				type="button"
				class="rp-al-action rp-al-action--delete"
				v-bind="deleteAttributes"
				@click="onDelete"
			>
				{{ tr('view.asset-library.delete') }}
			</button>
		</div>
		<p
			v-if="state === 'ready' && deleteReason !== null"
			:id="deleteReasonId"
			class="rp-al-actions__reason"
		>
			{{ deleteReason }}
		</p>
	</aside>
</template>
