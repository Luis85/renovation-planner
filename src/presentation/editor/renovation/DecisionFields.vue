<script setup lang="ts">
import { computed } from 'vue';
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { tr } from '../../i18n/strings';
import type { EditableRenovationDraft } from './renovationDraft';
import { type Renovation } from '../../../domain/renovation/Renovation';
import { contextOf } from '../../../domain/renovation/SharedLinks';
const draft = defineModel<EditableRenovationDraft>('draft', { required: true });
const props = defineProps<{ value: Renovation; frozen: boolean }>();
const current = computed(() => props.value.subjects.find(item => item.id === draft.value.decision.subjectId));
</script>
<template>
	<label>{{ tr('renovation.question') }}<textarea
		v-model="draft.decision.question"
		name="question"
		:readonly="frozen"
	/></label>
	<label>{{ tr('renovation.outcomes') }}<select
		v-model="draft.decision.subjectId"
		:aria-disabled="frozen"
		@change.capture="restoreInoperativeChoice($event, draft.decision.subjectId)"
	><option
		v-for="item in value.subjects.filter(subject => contextOf(subject) === (current ? contextOf(current) : draft.decision.roomId))"
		:key="item.id"
		:value="item.id"
	>{{ item.planned?.description || item.existing?.description }}</option></select></label>
	<label><input
		v-model="draft.decision.resolved"
		name="resolved"
		type="checkbox"
		:aria-disabled="frozen"
		@change.capture="restoreInoperativeChoice($event, draft.decision.resolved)"
	>{{ tr('renovation.resolved') }}</label>
	<label>{{ tr('renovation.resolution') }}<textarea
		v-model="draft.decision.resolution"
		name="resolution"
		:readonly="frozen"
	/></label>
</template>
