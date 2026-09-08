<script setup lang="ts">
import FieldError from '../../components/FieldError.vue';
import { tr } from '../../i18n/strings';
import type { StairText } from './stairInput';
const props = defineProps<{ modelValue: StairText; readonly: boolean; errors: ReadonlySet<keyof StairText> }>();
const emit = defineEmits<{ 'update:modelValue': [value: StairText] }>();
const dimensions = ['width', 'run', 'treads'] as const;
function update(field: keyof StairText, event: Event): void {
	const input = event.target as HTMLInputElement | HTMLSelectElement;
	if (props.readonly || (field === 'direction' && input.value !== 'up' && input.value !== 'down')) { input.value = props.modelValue[field]; return; }
	emit('update:modelValue', { ...props.modelValue, [field]: input.value });
}
</script>
<template>
	<fieldset class="rp-stair-fields">
		<legend>{{ tr('editor.stair.dimensions') }}</legend>
		<FieldError
			v-for="field in dimensions"
			:key="field"
			v-slot="{ inputId, aria }"
			:message="errors.has(field) ? tr(`editor.stair.${field}-invalid`) : null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>
				{{ tr(`editor.stair.${field}`) }}
				<input
					:id="inputId"
					v-bind="aria"
					:name="'stair-' + field"
					type="text"
					:inputmode="field === 'treads' ? 'numeric' : 'decimal'"
					:value="modelValue[field]"
					:readonly="readonly"
					@input="update(field, $event)"
				>
			</label>
		</FieldError>
		<label class="rp-dialog-field">
			{{ tr('editor.stair.direction') }}
			<select
				name="stair-direction"
				:value="modelValue.direction"
				:aria-disabled="readonly"
				@change="update('direction', $event)"
			>
				<option value="up">{{ tr('editor.stair.up') }}</option>
				<option value="down">{{ tr('editor.stair.down') }}</option>
			</select>
		</label>
	</fieldset>
</template>
