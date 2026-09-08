<script setup lang="ts">
import { computed } from 'vue';
import type { EditableRenovationDraft } from './renovationDraft';
import { validWorkSchedule } from '../../../domain/schedule/WorkSchedule';
import { tr } from '../../i18n/strings';
const work = defineModel<EditableRenovationDraft['work']>({ required: true });
const props = defineProps<{ frozen: boolean }>();
const valid = computed(() => validWorkSchedule(work.value.schedule));
const fields = ['start', 'end'] as const;
function input(field: 'start' | 'end', event: Event): void {
 const control = event.target as HTMLInputElement;
 if (props.frozen) { control.value = work.value.schedule?.[field] ?? ''; return; }
 const schedule = { ...work.value.schedule };
 if (control.value) schedule[field] = control.value; else delete schedule[field];
 const next = { ...work.value };
 if (schedule.start !== undefined || schedule.end !== undefined) next.schedule = schedule; else delete next.schedule;
 work.value = next;
}
</script>
<template>
	<fieldset>
		<legend>{{ tr('schedule.dates') }}</legend>
		<label
			v-for="field in fields"
			:key="field"
		>{{ tr(field === 'start' ? 'schedule.start' : 'schedule.end') }}
			<input
				:name="'schedule-' + field"
				:value="work.schedule?.[field] ?? ''"
				:readonly="frozen"
				:aria-invalid="!valid"
				placeholder="YYYY-MM-DD"
				@input="input(field, $event)"
			>
		</label>
		<p
			v-if="!valid"
			role="alert"
		>
			{{ tr('schedule.invalid') }}
		</p>
		<p>{{ tr('schedule.manual') }}</p>
	</fieldset>
</template>
