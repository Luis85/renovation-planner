<script setup lang="ts">
import ObjectRotationForm from '../elements/ObjectRotationForm.vue';
defineProps<{ summary: string; form: InstanceType<typeof ObjectRotationForm>['$props'] }>();
const emit = defineEmits<{ submit: [] }>();
</script>
<template>
	<p>{{ summary }}</p>
	<ObjectRotationForm
		v-bind="form"
		@submit="emit('submit')"
	/>
</template>
