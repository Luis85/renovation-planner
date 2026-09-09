<script setup lang="ts">
import FieldError from '../../components/FieldError.vue';
import { tr } from '../../i18n/strings';
defineProps<{ value: string; readonly: boolean; invalid: boolean }>();
const emit = defineEmits<{ input: [event: Event] }>();
</script>
<template>
	<FieldError
		v-slot="{ inputId, aria }"
		:message="invalid ? tr('editor.element.name-required') : null"
	>
		<label
			:for="inputId"
			class="rp-dialog-field"
		>{{ tr('editor.room.name') }}
			<input
				:id="inputId"
				v-bind="aria"
				name="name"
				type="text"
				:value="value"
				:readonly="readonly"
				@input="emit('input', $event)"
			>
		</label>
	</FieldError>
</template>
