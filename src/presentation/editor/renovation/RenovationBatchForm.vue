<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Ref } from 'vue';
import type { RenovationBaseline, RenovationInput } from '../../../application/commands/renovation/RenovationCommand';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { tr } from '../../i18n/strings';
import { renovationMessage } from './renovationMessage';
import { batchRenovationInput, type BatchKind, type BatchTarget, type BatchDraft } from './renovationBatch';
import { renovationReferents } from '../../../domain/renovation/renovationTargets';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
const props = defineProps<{ kind: BatchKind; targets: readonly BatchTarget[]; baseline: RenovationBaseline; busy: Ref<boolean>; paused: Readonly<Ref<boolean>>; files?: EvidenceFiles; dispatch: (input: RenovationInput) => Promise<DispatchResult> }>();
const emit = defineEmits<{ submit: [] }>();
const draft = ref<BatchDraft>({ kind: props.kind, id: '', title: '', path: '', type: 'document' });
const reviewed = ref(false), submitting = ref(false), error = ref(''), conflict = ref(false);
useDialogFormBusy(submitting, props.busy);
const frozen = computed(() => props.paused.value || props.busy.value || conflict.value);
let alive = true;
onBeforeUnmount(() => { alive = false; });
const value = props.baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
const records = computed(() => draft.value.kind === 'work' ? value.work.map(item => ({ id: item.id, label: item.title })) : (value.depth?.evidence ?? []).map(item => ({ id: item.id, label: item.description })));
const referents = [...new Set(props.targets.flatMap(item => renovationReferents(value, item.targetId)))];
const hosted = props.baseline.geometry.document.structure?.openings.filter(item => props.targets.some(target => target.targetId === item.hostId)) ?? [];
async function submit(): Promise<void> {
	if (frozen.value) return;
	if (draft.value.kind === 'evidence' && !draft.value.id) {
		const resolved = props.files?.resolve(draft.value.path + (draft.value.subpath ?? ''), props.baseline.plan.entity.id);
		if (!resolved?.ok) { error.value = tr('renovation.batch.file-required'); return; }
		draft.value.path = resolved.value.path; draft.value.subpath = resolved.value.subpath;
	}
	const input = batchRenovationInput(props.baseline, props.targets, draft.value);
	if (!input.ok) { error.value = renovationMessage(input.error); return; }
	if (!reviewed.value) { reviewed.value = true; error.value = ''; return; }
	submitting.value = true;
	try {
		const result = await props.dispatch(input.value);
		if (!alive) return;
		if (result.ok) emit('submit');
		else { error.value = renovationMessage(result.error); conflict.value = true; }
	} catch { if (alive) { error.value = tr('renovation.batch.failed'); conflict.value = true; } }
	finally { submitting.value = false; }
}
</script>
<template>
	<form
		class="rp-dialog-form rp-renovation-batch"
		data-rp-form="renovation-batch"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
		@input="reviewed = false"
		@change="reviewed = false"
	>
		<p>{{ tr('renovation.batch.scope', { count: String(targets.length) }) }}</p>
		<ul>
			<li
				v-for="target in targets"
				:key="target.targetId"
			>
				{{ target.name }}
			</li>
		</ul>
		<p
			v-if="error"
			role="alert"
		>
			{{ error }}
		</p>
		<template v-if="kind === 'work' || kind === 'evidence'">
			<label>{{ tr('renovation.batch.record') }}<select
				v-model="draft.id"
				:disabled="frozen"
			><option value="">{{ tr('renovation.batch.new') }}</option><option
				v-for="record in records"
				:key="record.id"
				:value="record.id"
			>{{ record.label }}</option></select></label>
		</template>
		<label v-if="kind !== 'remove' && !draft.id">{{ tr('renovation.batch.description') }}<input
			v-model="draft.title"
			name="batch-title"
			required
			:disabled="frozen"
		></label>
		<template v-if="kind === 'evidence' && !draft.id">
			<label>{{ tr('renovation.batch.file') }}<select
				v-model="draft.path"
				required
				:disabled="frozen"
				@change="draft.subpath = ''"
			><option value="">{{ tr('renovation.batch.file-required') }}</option><option
				v-for="path in files?.list() ?? []"
				:key="path"
				:value="path"
			>{{ path }}</option></select></label>
			<label>{{ tr('renovation.kind') }}<select
				v-model="draft.type"
				:disabled="frozen"
			><option value="document">{{ tr('renovation.documents') }}</option><option value="photo">{{ tr('renovation.photos') }}</option><option value="note">{{ tr('renovation.notes') }}</option></select></label>
		</template>
		<template v-if="reviewed">
			<p>{{ tr('renovation.batch.preview') }}</p>
			<p v-if="kind === 'remove' && hosted.length">
				{{ tr('renovation.batch.hosted', { count: String(hosted.length) }) }}
			</p>
			<p v-if="referents.length">
				{{ tr('renovation.links', { names: referents.join(', ') }) }}
			</p>
		</template>
		<div class="rp-dialog-form-actions">
			<button
				type="submit"
				:disabled="frozen"
			>
				{{ tr(reviewed ? 'renovation.apply' : 'renovation.preview') }}
			</button>
		</div>
	</form>
</template>
