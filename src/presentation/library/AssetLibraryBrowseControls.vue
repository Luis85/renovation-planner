<!--
	The toolbar's AD18-R18 controls, beside §3.1's search field and `New asset`: the funnel that
	shows and hides the category sidebar, and the `Grid | List` switch.

	**Every control here carries an `aria-label`, because Obsidian draws its hover tooltip from
	`aria-label` and from nothing else** — an icon-only button named only by hidden text has no
	tooltip at all, the defect `DesignerHeader.vue`'s back button records as fixed once already.

	**The funnel names an active filter in WORDS**, visibly beside its icon and again in its
	`aria-label` (`Filter by category, Fixture`), so the name contains the visible text (WCAG
	2.5.3). The sidebar can be closed while a filter holds, and a catalogue quietly missing most of
	its assets must say why, and not by colour alone. `aria-expanded` carries whether the sidebar
	shows, and `aria-controls` names it.

	A component of its own so the root's template grows by one tag rather than by a conditional
	region, which is the budget `AssetLibraryBody.vue`'s header records the root running short of.

	**Two toggle buttons in a named group, each `aria-pressed`**, rather than a radio group: both
	are ordinary buttons Obsidian already styles, reached by Tab like every other toolbar control.
	Each carries its icon and its word, with the word as its `aria-label`, so below 35rem the word
	can leave the layout outright and the name and the tooltip stay.
-->
<script setup lang="ts">
import { computed } from 'vue';
import HostIcon from '../components/HostIcon.vue';
import { tr } from '../i18n/strings';
import type { LibraryLayout } from './libraryBrowse';
import { categoryLabel } from './shelfList';

const props = defineProps<{
	layout: LibraryLayout;
	/** The sidebar's filter, `''` for All. */
	category: string;
	sidebarOpen: boolean;
	/** The sidebar's element id, for the funnel's `aria-controls`. */
	sidebarId: string;
}>();

const emit = defineEmits<{ layout: [layout: LibraryLayout]; 'toggle-filter': [] }>();

const LAYOUTS = [
	{ layout: 'grid', icon: 'grid-2x-2', label: 'view.asset-library.layout.grid' },
	{ layout: 'list', icon: 'list', label: 'view.asset-library.layout.list' },
] as const;

const filterLabel = computed(() =>
	props.category === ''
		? tr('view.asset-library.filter')
		: tr('view.asset-library.filter.active', { category: categoryLabel(props.category) }),
);
</script>

<template>
	<button
		type="button"
		class="rp-al-filter"
		:class="{ 'rp-al-filter--on': category !== '' }"
		:aria-label="filterLabel"
		:aria-expanded="sidebarOpen"
		:aria-controls="sidebarId"
		@click="emit('toggle-filter')"
	>
		<HostIcon name="funnel" />
		<span
			v-if="category !== ''"
			class="rp-al-filter__category"
		>{{ categoryLabel(category) }}</span>
	</button>
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
			:aria-label="tr(option.label)"
			:aria-pressed="layout === option.layout"
			@click="emit('layout', option.layout)"
		>
			<HostIcon :name="option.icon" />
			<span class="rp-al-layout__word">{{ tr(option.label) }}</span>
		</button>
	</div>
</template>
