<script setup lang="ts">
import { computed } from 'vue';
import FieldError from '../../components/FieldError.vue';
import { parseSwingDraft, type OpeningSwingDraft } from './openingSwingDraft';
import { tr } from '../../i18n/strings';
const props = defineProps<{ modelValue: OpeningSwingDraft; disabled: boolean }>();
const invalid = computed(() => parseSwingDraft(props.modelValue) === null ? tr('editor.structure.error.opening-swing') : null);
const emit = defineEmits<{ 'update:modelValue': [value: OpeningSwingDraft] }>();
function change(field: keyof OpeningSwingDraft, event: Event): void {
	const input = event.target as HTMLInputElement | HTMLSelectElement;
	if (props.disabled) { input.value = props.modelValue[field]; return; }
	emit('update:modelValue', { ...props.modelValue, [field]: input.value });
}
</script>
<template>
	<fieldset
		class="rp-opening-swing"
		:disabled="disabled"
	>
		<legend>{{ tr('editor.opening.symbol') }}</legend>
		<label class="rp-dialog-field">{{ tr('editor.opening.hinge') }}
			<select
				name="opening-hinge"
				:value="modelValue.hinge"
				@change="change('hinge', $event)"
			>
				<option value="start">{{ tr('editor.opening.start') }}</option>
				<option value="end">{{ tr('editor.opening.end') }}</option>
			</select>
		</label>
		<label class="rp-dialog-field">{{ tr('editor.opening.side') }}
			<select
				name="opening-side"
				:value="modelValue.side"
				@change="change('side', $event)"
			>
				<option value="left">{{ tr('editor.opening.left') }}</option>
				<option value="right">{{ tr('editor.opening.right') }}</option>
			</select>
		</label>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="invalid"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>{{ tr('editor.opening.angle') }}
				<input
					:id="inputId"
					v-bind="aria"
					name="opening-angle"
					type="text"
					inputmode="decimal"
					:value="modelValue.angle"
					@input="change('angle', $event)"
				>
			</label>
		</FieldError>
		<p>{{ tr('editor.opening.direction-help') }}</p>
	</fieldset>
</template>
