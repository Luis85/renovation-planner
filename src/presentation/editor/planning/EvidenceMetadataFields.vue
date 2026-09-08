<script setup lang="ts">
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { recordChoices } from './recordChoices';
import type { PlanningDraft } from './planningDraft';
import type { PlanningBaseline } from '../../../application/commands/renovation/PlanningServices';
import { EVIDENCE_PHASES, EVIDENCE_TYPES } from '../../../domain/renovation/PlanningDepth';
import { tr } from '../../i18n/strings';
const draft = defineModel<PlanningDraft>('draft', { required: true });
defineProps<{ baseline: PlanningBaseline; paused: boolean }>();
const emit = defineEmits<{ typeChanged: [event: Event] }>();
</script>
<template>
	<label>{{ tr('planning.type') }}<select
		v-model="draft.type"
		:aria-disabled="paused"
		name="type"
		@change.capture="restoreInoperativeChoice($event, draft.type)"
		@change="emit('typeChanged', $event)"
	><option
		v-for="type in EVIDENCE_TYPES"
		:key="type"
		:value="type"
	>{{ tr(`planning.${type}`) }}</option></select></label>
	<label>{{ tr('planning.evidence-date') }}<input
		v-model="draft.date"
		:readonly="paused"
		name="evidence-date"
		:placeholder="tr('planning.evidence-date-format')"
	></label>
	<p>{{ tr('planning.evidence-date-help') }}</p>
	<label>{{ tr('planning.phase') }}<select
		v-model="draft.phase"
		:aria-disabled="paused"
		name="phase"
		@change.capture="restoreInoperativeChoice($event, draft.phase)"
	><option
		v-for="phase in EVIDENCE_PHASES"
		:key="phase"
		:value="phase"
	>{{ tr(`planning.${phase}`) }}</option></select></label>
	<label>{{ tr('planning.linked-record') }}<select
		v-model="draft.recordId"
		:aria-disabled="paused"
		name="record"
		@change.capture="restoreInoperativeChoice($event, draft.recordId)"
	><option value="">{{ tr('planning.unassigned') }}</option><option
		v-for="record in recordChoices(baseline, draft.roomId)"
		:key="record.id"
		:value="record.id"
	>{{ record.label }}</option></select></label>
	<label><input
		v-model="draft.pin"
		:aria-disabled="paused"
		type="checkbox"
		@change.capture="restoreInoperativeChoice($event, draft.pin)"
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
</template>
