<!--
	The row's leading mark: the asset's own footprint, drawn from the coordinates the Asset
	designer captured, fitted to a 20px box at its true aspect ratio.

	A file of its own for the reason the inspector is: `AssetShelf.vue` crossed `max-lines` at 418
	when the fifth state arrived. The seam is a real one rather than convenient — this is the
	signature element of the whole surface, the one thing on it no Bases view could ever draw, and
	the thing §3.4 of the specification is entirely about.

	`aria-hidden`, always. The shape's state is written in words in the inspector, because a drawn
	outline that is the only statement of a fact is the colour-alone failure in a different medium.

	No `<style>` block, since Task 12 (`src/presentation/library/AssetMark.vue`): this mock's
	classes are declared in `styles/asset-mark.css` now, which the harness's assembled sheet loads
	the same as a shipped component's — a scoped block here would be a second, unreachable copy of
	those same rules, and `tests/build/prototype-styles.test.ts` refuses a mock declaring a class a
	real component uses. `ZoneSummary.vue`, this tree's other fully-promoted mock, carries no
	`<style>` for the identical reason.

	`selected` is gone with it, for the same reason rather than a second one: Task 12's own
	contract for the real component carries no such prop, because §3.3 makes selection a fact of
	the ROW alone — a leading box-shadow rule plus `aria-current` — never of the mark, which
	already carries five states of its own. Keeping this mock recolouring on selection would be
	demonstrating a visual claim the shipped design deliberately dropped.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { ASSETS, markPath, type CatalogueAsset } from './assetLibraryFixture';

/**
 * Defaulted like every region in this tree, so the mark draws as a specimen on the harness
 * index too — the index mounts an entry bare, and a component that needs a parent to exist is
 * one nobody looks at.
 */
const props = withDefaults(defineProps<{
	asset?: CatalogueAsset;
}>(), {
	asset: () => ASSETS[0] as CatalogueAsset,
});

const path = computed((): string =>
	props.asset.outline === null ? '' : markPath(props.asset.outline, 20, 2));

</script>

<template>
	<svg
		class="rp-al-mark"
		:class="`rp-al-mark--${asset.shape}`"
		viewBox="0 0 20 20"
		aria-hidden="true"
	>
		<path
			v-if="asset.outline !== null"
			:d="path"
		/>
		<circle
			v-for="x in (asset.shape === 'pending' ? [5, 10, 15] : [])"
			:key="x"
			class="rp-al-mark__dot"
			:cx="x"
			cy="10"
			r="1.1"
		/>
		<template v-if="asset.shape === 'unreadable'">
			<rect
				x="2.5"
				y="2.5"
				width="15"
				height="15"
			/>
			<path d="M5.5 5.5 L14.5 14.5 M14.5 5.5 L5.5 14.5" />
		</template>
	</svg>
</template>
