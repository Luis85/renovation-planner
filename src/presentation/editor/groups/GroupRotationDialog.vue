<script setup lang="ts">
import { computed, type Ref } from 'vue';
import ObjectRotationForm from '../elements/ObjectRotationForm.vue';
import { tr } from '../../i18n/strings';
const props = defineProps<{ summary: string; affectedNeighbours: Readonly<Ref<number>>; form: InstanceType<typeof ObjectRotationForm>['$props'] }>();
const count = computed(() => props.affectedNeighbours.value);
const emit = defineEmits<{ submit: [] }>();
</script>
<template>
	<p>{{ summary }}</p>
	<p
		v-if="count > 0"
		data-rp-group-rotation-impact
		role="status"
		aria-live="polite"
	>
		<strong>{{ tr('editor.group.connected-title') }}</strong>
		{{ tr('editor.group.connected-hint', { count: String(count) }) }}
	</p>
	<ObjectRotationForm
		v-bind="form"
		@submit="emit('submit')"
	/>
</template>
