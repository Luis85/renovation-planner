<script setup lang="ts">
import FieldError from '../../components/FieldError.vue';
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
/** `label` names what the name IS where it is not a name — a text's words (plan drafting tools design §5). */
defineProps<{ value: string; readonly: boolean; invalid: boolean; label?: StringKey }>();
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
		>{{ tr(label ?? 'editor.room.name') }}
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
