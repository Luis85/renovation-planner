<script setup lang="ts">
import FormBanner from '../../components/FormBanner.vue';
import DraftRecovery from './DraftRecovery.vue';
import GeometryNameField from './GeometryNameField.vue';
/** The head an element geometry edit form opens with: draft recovery, the banner, the newer-version notice and the name. */
defineProps<{ blocked: boolean; busy: boolean; retry: () => Promise<void>; openSource: () => Promise<void>; banner: string | null; latest: string | null; name: string; readonly: boolean }>();
const emit = defineEmits<{ nameInput: [event: Event] }>();
</script>
<template>
	<DraftRecovery
		v-if="blocked && !busy"
		:retry="retry"
		:open-source="openSource"
	/>
	<FormBanner :message="banner" />
	<p
		v-if="latest"
		role="status"
	>
		{{ latest }}
	</p>
	<GeometryNameField
		:value="name"
		:readonly="readonly"
		:invalid="!name.trim()"
		@input="emit('nameInput', $event)"
	/>
</template>
