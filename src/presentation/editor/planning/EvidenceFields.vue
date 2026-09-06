<script setup lang="ts">
import { recordChoices } from './recordChoices';
import { onBeforeUnmount, ref, useId } from 'vue';
import type { PlanningDraft } from './planningDraft';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import type { EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import { EVIDENCE_PHASES, EVIDENCE_TYPES } from '../../../domain/renovation/PlanningDepth';
import { tr } from '../../i18n/strings';
const draft = defineModel<PlanningDraft>('draft', { required: true });
const props = defineProps<{ baseline: PlanningBaseline; paused: boolean; writeBlocked?: boolean; files?: EvidenceFiles }>();
const filesId = useId();
const error = ref(false), working = ref(false);
let alive = true;
onBeforeUnmount(() => { alive = false; });
async function create(file?: File): Promise<void> {
	if (!props.files || props.paused || props.writeBlocked || working.value) return;
	working.value = true; error.value = false;
	try {
		const result = file ? await props.files.importFile(props.baseline.plan.entity.id, file.name, await file.arrayBuffer())
			: await props.files.createNote(props.baseline.plan.entity.id, draft.value.id, `# ${draft.value.title || tr('planning.note')}\n\n${tr('planning.context-note', { room: draft.value.roomId })}\n`);
		if (!alive) return;
		if (result.ok) { draft.value.path = result.value; if (!file) draft.value.type = 'note'; } else error.value = true;
	} catch { if (alive) error.value = true; }
	finally { working.value = false; }
}
function importFile(event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) void create(file); }
</script>
<template>
	<label>{{ tr('planning.path') }}<input
		v-model="draft.path"
		:readonly="paused || writeBlocked || working"
		name="path"
		:list="filesId"
	></label>
	<datalist :id="filesId">
		<option
			v-for="path in files?.list()"
			:key="path"
			:value="path"
		/>
	</datalist>
	<label>{{ tr('planning.type') }}<select
		v-model="draft.type"
		:disabled="paused"
		name="type"
	><option
		v-for="type in EVIDENCE_TYPES"
		:key="type"
		:value="type"
	>{{ tr(`planning.${type}`) }}</option></select></label>
	<label>{{ tr('planning.phase') }}<select
		v-model="draft.phase"
		:disabled="paused"
		name="phase"
	><option
		v-for="phase in EVIDENCE_PHASES"
		:key="phase"
		:value="phase"
	>{{ tr(`planning.${phase}`) }}</option></select></label>
	<label>{{ tr('planning.linked-record') }}<select
		v-model="draft.recordId"
		:disabled="paused"
		name="record"
	><option value="">{{ tr('planning.unassigned') }}</option><option
		v-for="record in recordChoices(baseline, draft.roomId)"
		:key="record.id"
		:value="record.id"
	>{{ record.label }}</option></select></label>
	<label><input
		v-model="draft.pin"
		:disabled="paused"
		type="checkbox"
	>{{ tr('planning.pin') }}</label>
	<template v-if="draft.pin">
		<label>{{ tr('planning.pin-x') }}<input
			v-model="draft.pinX"
			:readonly="paused"
			inputmode="decimal"
		></label><label>{{ tr('planning.pin-y') }}<input
			v-model="draft.pinY"
			:readonly="paused"
			inputmode="decimal"
		></label>
	</template>
	<template v-if="files">
		<button
			type="button"
			:disabled="paused || writeBlocked || working || !!draft.path"
			@click="create()"
		>
			{{ tr('planning.create-note') }}
		</button>
		<label>{{ tr('planning.import') }}<input
			type="file"
			accept=".md,.pdf,.png,.jpg,.jpeg,.gif,.webp"
			:disabled="paused || writeBlocked || working"
			@change="importFile"
		></label>
	</template>
	<p
		v-if="error"
		role="alert"
	>
		{{ tr('planning.file-failed') }}
	</p>
	<p>{{ tr('planning.file-policy') }}</p>
</template>
