<script setup lang="ts">
import FormBanner from '../../components/FormBanner.vue';
defineProps<{ message: string | null; latest: string | null }>();
</script>
<template>
	<FormBanner :message="message" />
	<p
		v-if="latest !== null"
		role="status"
	>
		{{ latest }}
	</p>
</template>
