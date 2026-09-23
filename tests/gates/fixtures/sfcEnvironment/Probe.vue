<script setup lang="ts">
defineProps<{ shown: boolean }>();
</script>

<template>
	<p v-if="shown">shown</p>
</template>
