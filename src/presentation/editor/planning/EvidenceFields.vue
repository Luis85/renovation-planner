<script setup lang="ts">
import { refuseInoperativeEvent, restoreInoperativeChoice } from '../forms/inoperativeControl';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { PlanningDraft } from './planningDraft';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { isEvidenceImage, type EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import { tr } from '../../i18n/strings';
import EvidenceFileSearch from './EvidenceFileSearch.vue';
import EvidenceMetadataFields from './EvidenceMetadataFields.vue';
const draft = defineModel<PlanningDraft>('draft', { required: true });
const props = defineProps<{ baseline: PlanningBaseline; paused: boolean; writeBlocked?: boolean; files?: EvidenceFiles }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const detailsOpen = ref(false);
const photo = computed(() => draft.value.type === 'photo');
const error = ref<'file' | 'image' | null>(null), working = ref(false);
const fileActionBlocked = computed(() => props.paused || props.writeBlocked || working.value);
watch(working, value => emit('busy', value), { flush: 'sync' });
let alive = true;
onBeforeUnmount(() => { alive = false; emit('busy', false); });
async function create(file?: File): Promise<void> {
	if (!props.files || fileActionBlocked.value) return;
	if (file && photo.value && !isEvidenceImage(file.name)) { error.value = 'image'; return; }
	working.value = true; error.value = null;
	try {
		const result = file ? await props.files.importFile(props.baseline.plan.entity.id, file.name, await file.arrayBuffer())
			: await props.files.createNote(props.baseline.plan.entity.id, draft.value.id, `# ${draft.value.title || tr('planning.note')}\n\n${tr('planning.context-note', { room: draft.value.roomId })}\n`);
		if (!alive) return;
		if (result.ok) { draft.value.path = result.value; if (!file) draft.value.type = 'note'; } else error.value = 'file';
	} catch { if (alive) error.value = 'file'; }
	finally { working.value = false; }
}
async function keepTypeFocus(event: Event): Promise<void> {
	const control = event.target as HTMLElement;
	if (control.ownerDocument.activeElement !== control) return;
	const form = control.closest('.rp-dialog-form');
	detailsOpen.value = photo.value;
	await nextTick();
	if (form?.isConnected && (control.ownerDocument.activeElement === control || control.ownerDocument.activeElement === control.ownerDocument.body)) {
		form.querySelector<HTMLElement>('[name="type"]')?.focus();
	}
}
function importFile(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) void create(file); }
</script>
<template>
	<EvidenceFileSearch
		v-model="draft.path"
		:files="files"
		:images-only="photo"
		:paused="paused || working"
	/>
	<label v-if="photo && files">{{ tr('planning.photo.import') }}<input
		type="file"
		accept=".png,.jpg,.jpeg,.gif,.webp"
		:aria-disabled="fileActionBlocked"
		@click.capture="refuseInoperativeEvent"
		@change.capture="restoreInoperativeChoice($event, '')"
		@change="importFile"
	></label>
	<label v-if="photo">{{ tr('planning.photo.caption') }}<input
		v-model="draft.title"
		name="title"
		:readonly="paused"
	></label>
	<details
		v-if="photo"
		class="rp-photo-details"
		:open="detailsOpen"
		@toggle="detailsOpen = ($event.target as HTMLDetailsElement).open"
	>
		<summary>{{ tr('planning.photo.details') }}</summary>
		<div class="rp-photo-details__content">
			<slot name="context" />
			<EvidenceMetadataFields
				:draft="draft"
				:baseline="baseline"
				:paused="paused || working"
				@type-changed="keepTypeFocus"
			/>
			<p>{{ tr('planning.file-policy') }}</p>
		</div>
	</details>
	<template v-else>
		<EvidenceMetadataFields
			:draft="draft"
			:baseline="baseline"
			:paused="paused || working"
			@type-changed="keepTypeFocus"
		/>
		<template v-if="files">
			<button
				type="button"
				:aria-disabled="fileActionBlocked || !!draft.path"
				@click.capture="refuseInoperativeEvent"
				@click="create()"
			>
				{{ tr('planning.create-note') }}
			</button>
			<label>{{ tr('planning.import') }}<input
				type="file"
				accept=".md,.pdf,.png,.jpg,.jpeg,.gif,.webp"
				:aria-disabled="fileActionBlocked"
				@click.capture="refuseInoperativeEvent"
				@change.capture="restoreInoperativeChoice($event, '')"
				@change="importFile"
			></label>
		</template>
		<p>{{ tr('planning.file-policy') }}</p>
	</template>
	<p
		v-if="working && photo"
		role="status"
	>
		{{ tr('planning.photo.importing') }}
	</p>
	<p
		v-if="error"
		role="alert"
	>
		{{ tr(error === 'image' ? 'planning.photo.image-required' : 'planning.file-failed') }}
	</p>
</template>
