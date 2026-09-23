<!--
	AD18-R18's category sidebar (board 01's right-hand column): `All`, then every category
	`shelfList.shelvesOf` derives, each with its icon. It FILTERS the catalogue in both layouts
	and manages nothing (§10's "No category management"): no add, rename or reorder, only a choice.

	The list is the shelves' own derivation, so it grows with an open vocabulary (§1a) with no
	edit here. A category the build does not declare takes the `tag` icon, which is also why that
	arm exists at all, since §3.2's group 2 cannot reach a shelf in today's code.

	Toggle buttons with `aria-pressed`, one pressed at a time, for the reason
	`AssetLibraryBrowseControls.vue` gives for its own switch. `↑`/`↓` are `shelfFocus.moveFocus`,
	the one focus manager this surface has.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { IconName } from 'obsidian';
import HostIcon from '../components/HostIcon.vue';
import { tr } from '../i18n/strings';
import type { AssetCategory } from '../../domain/asset/AssetCategory';
import type { Shelf } from './shelfList';
import { moveFocus } from './shelfFocus';

const props = defineProps<{
	shelves: readonly Shelf[];
	/** The chosen category, `''` for All. */
	category: string;
	/**
	 * The funnel's answer. `v-show` rather than `v-if`, so the list keeps its scroll position
	 * across a toggle, and it is applied here rather than at the root so the root's template
	 * carries no conditional for it.
	 */
	open: boolean;
	/** Not yet pressed: the stylesheet withdraws it below §7's 35rem rung (`useCategorySidebar.ts`). */
	auto: boolean;
	/** The funnel's `aria-controls` target. */
	id: string;
}>();

const emit = defineEmits<{ choose: [category: string] }>();

const ICONS: ReadonlyMap<string, IconName> = new Map<AssetCategory, IconName>([
	['material', 'layers'],
	['furniture', 'armchair'],
	['fixture', 'bath'],
	['plant', 'sprout'],
	['equipment', 'hammer'],
	['building-element', 'brick-wall'],
	['custom', 'pencil'],
]);

const options = computed(() => [
	{ category: '', label: tr('view.asset-library.category.all'), icon: 'grid-2x-2' },
	...props.shelves.map((shelf) => ({
		category: shelf.category,
		label: shelf.label,
		icon: ICONS.get(shelf.category) ?? 'tag',
	})),
]);
</script>

<template>
	<ul
		v-show="open"
		:id="id"
		class="rp-al-categories"
		:class="{ 'rp-al-categories--auto': auto }"
		:aria-label="tr('view.asset-library.categories')"
		@keydown.down="moveFocus($event, 1)"
		@keydown.up="moveFocus($event, -1)"
	>
		<li
			v-for="option in options"
			:key="option.category"
		>
			<button
				type="button"
				class="rp-al-category"
				:aria-pressed="option.category === category"
				@click="emit('choose', option.category)"
			>
				<HostIcon :name="option.icon" />
				<span class="rp-al-category__label">{{ option.label }}</span>
			</button>
		</li>
	</ul>
</template>
