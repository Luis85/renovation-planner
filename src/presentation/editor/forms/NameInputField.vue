<script setup lang="ts">
import FieldError from '../../components/FieldError.vue';
defineProps<{ value: string; label: string; message: string | null; paused: boolean; hintId?: string }>();
const emit = defineEmits<{ input: [event: Event] }>();
</script>
<template>
	<FieldError
		v-slot="{ inputId, aria }"
		:message="message"
	>
		<label
			:for="inputId"
			class="rp-dialog-field"
		>{{ label }}
			<input
				:id="inputId"
				v-bind="aria"
				name="name"
				data-field="name"
				type="text"
				:value="value"
				:readonly="paused"
				:aria-describedby="[hintId, aria['aria-describedby']].filter(Boolean).join(' ') || undefined"
				@input="emit('input', $event)"
			>
		</label>
	</FieldError>
</template>
