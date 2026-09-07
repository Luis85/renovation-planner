<script setup lang="ts">
import WorkResponsibilityFields from '../../catalogue/WorkResponsibilityFields.vue';
import WorkScheduleFields from './WorkScheduleFields.vue';
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { tr } from '../../i18n/strings';
import type { EditableRenovationDraft } from './renovationDraft';
import { WORK_PROGRESS, type Renovation } from '../../../domain/renovation/Renovation';
import { hasRoomContext } from '../../../domain/renovation/SharedLinks';
const draft = defineModel<EditableRenovationDraft>('draft', { required: true });
defineProps<{ value: Renovation; frozen: boolean }>();
</script>
<template>
	<label>{{ tr('renovation.title') }}<input
		v-model="draft.work.title"
		name="title"
		:readonly="frozen"
	></label>
	<label>{{ tr('renovation.description') }}<textarea
		v-model="draft.work.description"
		:readonly="frozen"
	/></label>
	<label>{{ tr('renovation.order') }}<input
		v-model.number="draft.work.order"
		name="order"
		type="number"
		min="0"
		:readonly="frozen"
	></label>
	<label>{{ tr('renovation.progress') }}
		<select
			v-model="draft.work.progress"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, draft.work.progress)"
		><option
			v-for="progress in WORK_PROGRESS"
			:key="progress"
			:value="progress"
		>{{ tr(`renovation.progress.${progress}`) }}</option></select>
	</label>
	<WorkResponsibilityFields
		v-model="draft.work"
		:frozen="frozen"
	/>
	<WorkScheduleFields
		v-model="draft.work"
		:frozen="frozen"
	/>
	<fieldset>
		<legend>{{ tr('renovation.outcomes') }}</legend>
		<label
			v-for="item in value.subjects.filter(subject => hasRoomContext(draft.work, subject.roomId) && subject.planned)"
			:key="item.id"
		><input
			v-model="draft.work.outcomes"
			type="checkbox"
			:value="item.id"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, draft.work.outcomes)"
		>{{ item.planned?.description || item.existing?.description }}</label>
	</fieldset>
	<fieldset>
		<legend>{{ tr('renovation.dependencies') }}</legend>
		<label
			v-for="item in value.work.filter(work => work.id !== draft.work.id)"
			:key="item.id"
		><input
			v-model="draft.work.dependencies"
			type="checkbox"
			:value="item.id"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, draft.work.dependencies)"
		>{{ item.title }}</label>
	</fieldset>
</template>
