<script setup lang="ts">
import { useId } from 'vue';

defineProps<{ message: string | null }>();

const inputId = useId();
const messageId = useId();
</script>

<template>
	<div class="rp-field-error">
		<!--
			The ARIA pair goes on the CONTROL, never on this wrapper: a screen reader reads
			`aria-invalid` and `aria-describedby` off the control they describe, and they mean
			nothing on a div. Handed down rather than applied by lookup, so there is no id to
			collide and no document to search.
		-->
		<slot
			:input-id="inputId"
			:aria="message === null ? {} : ({ 'aria-invalid': 'true', 'aria-describedby': messageId } as const)"
		/>
		<p
			v-if="message !== null"
			:id="messageId"
			class="rp-field-error__message"
		>
			<span
				class="rp-field-error__glyph"
				aria-hidden="true"
			>⚠</span>
			{{ message }}
		</p>
	</div>
</template>
