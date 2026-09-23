<!--
	The toolbar's AD18-R18 controls, beside §3.1's search field and `New asset`: the `Grid | List`
	switch.

	A component of its own so the root's template grows by one tag rather than by a conditional
	region, which is the budget `AssetLibraryBody.vue`'s header records the root running short of.

	**Two toggle buttons in a named group, each `aria-pressed`**, rather than a radio group: both
	are ordinary buttons Obsidian already styles, reached by Tab like every other toolbar control.
	Each carries its icon and its word, and below 35rem the word is visually hidden rather than
	removed, so the accessible name stays the visible label (WCAG 2.5.3).
-->
<script setup lang="ts">
import HostIcon from '../components/HostIcon.vue';
import { tr } from '../i18n/strings';
import type { LibraryLayout } from './libraryBrowse';

defineProps<{ layout: LibraryLayout }>();

const emit = defineEmits<{ layout: [layout: LibraryLayout] }>();

const LAYOUTS = [
	{ layout: 'grid', icon: 'grid-2x-2', label: 'view.asset-library.layout.grid' },
	{ layout: 'list', icon: 'list', label: 'view.asset-library.layout.list' },
] as const;
</script>

<template>
	<div
		class="rp-al-layout"
		role="group"
		:aria-label="tr('view.asset-library.layout.label')"
	>
		<button
			v-for="option in LAYOUTS"
			:key="option.layout"
			type="button"
			class="rp-al-layout__option"
			:aria-pressed="layout === option.layout"
			@click="emit('layout', option.layout)"
		>
			<HostIcon :name="option.icon" />
			<span class="rp-al-layout__word">{{ tr(option.label) }}</span>
		</button>
	</div>
</template>
