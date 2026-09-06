<script setup lang="ts">
import { tr } from '../../i18n/strings';
import type { EditableRenovationDraft } from './renovationDraft';
import { type Renovation } from '../../../domain/renovation/Renovation';
const draft = defineModel<EditableRenovationDraft>('draft', { required: true });
defineProps<{ value: Renovation; frozen: boolean }>();
</script>
<template>
	<label>{{ tr('renovation.question') }}<textarea
		v-model="draft.decision.question"
		name="question"
		:readonly="frozen"
	/></label>
	<label>{{ tr('renovation.outcomes') }}<select
		v-model="draft.decision.subjectId"
		:disabled="frozen"
	><option
		v-for="item in value.subjects.filter(subject => subject.roomId === draft.decision.roomId)"
		:key="item.id"
		:value="item.id"
	>{{ item.planned?.description || item.existing?.description }}</option></select></label>
	<label><input
		v-model="draft.decision.resolved"
		name="resolved"
		type="checkbox"
		:disabled="frozen"
	>{{ tr('renovation.resolved') }}</label>
	<label>{{ tr('renovation.resolution') }}<textarea
		v-model="draft.decision.resolution"
		name="resolution"
		:readonly="frozen"
	/></label>
</template>
