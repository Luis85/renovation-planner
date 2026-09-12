<script setup lang="ts">
/**
 * One collapsible sidebar section (2026-09-12 side panels spec §2): a `<details>` whose summary is
 * the heading, with the chevron as a host icon rather than a CSS-border shape. `data-rp-section` is
 * what a collapsed strip's section button opens. `open` is the DEFAULT only — the sidebar polish
 * spec's rule that which sections are open is not persisted, kept.
 */
import HostIcon from '../../components/HostIcon.vue';

defineProps<{ section: string; title: string; open?: boolean }>();
</script>

<template>
	<details
		class="rp-sidebar-section"
		:class="`rp-property-${section}`"
		:data-rp-section="section"
		:open="open"
	>
		<summary class="rp-sidebar-section__summary">
			<span>{{ title }}</span>
			<HostIcon
				name="chevron-down"
				class="rp-sidebar-section__chevron"
			/>
		</summary>
		<slot />
	</details>
</template>
