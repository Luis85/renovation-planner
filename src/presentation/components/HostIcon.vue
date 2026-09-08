<script setup lang="ts">
import { setIcon, type IconName } from 'obsidian';
import { ref, watch } from 'vue';

/** Native Lucide or explicitly registered application artwork; never substitute a missing icon. */
const props = defineProps<{ name: IconName }>();
const root = ref<HTMLElement | null>(null);
watch([root, () => props.name], ([element, name]) => {
	if (element) setIcon(element, name.startsWith('lucide-') || name.startsWith('rp-') ? name : `lucide-${name}`);
}, { immediate: true, flush: 'post' });
</script>

<template>
	<span
		ref="root"
		class="rp-host-icon"
		aria-hidden="true"
	/>
</template>
