<script setup lang="ts">
import { setIcon, type IconName } from 'obsidian';
import { ref, watch } from 'vue';

/** Decorative companion to native visible text; the host owns the icon catalogue. */
const props = defineProps<{ name: IconName }>();
const root = ref<HTMLElement | null>(null);
watch([root, () => props.name], ([element, name]) => { if (element) setIcon(element, name); }, { immediate: true, flush: 'post' });
</script>

<template>
	<span
		ref="root"
		class="rp-host-icon"
		aria-hidden="true"
	/>
</template>
