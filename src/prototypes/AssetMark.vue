<!--
	The row's leading mark: the asset's own footprint, drawn from the coordinates the Asset
	designer captured, fitted to a 20px box at its true aspect ratio.

	A file of its own for the reason the inspector is: `AssetShelf.vue` crossed `max-lines` at 418
	when the fifth state arrived. The seam is a real one rather than convenient — this is the
	signature element of the whole surface, the one thing on it no Bases view could ever draw, and
	the thing §3.4 of the specification is entirely about.

	`aria-hidden`, always. The shape's state is written in words in the inspector, because a drawn
	outline that is the only statement of a fact is the colour-alone failure in a different medium.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { ASSETS, markPath, type CatalogueAsset } from './assetLibraryFixture';

/**
 * Defaulted like every region in this tree, so the mark draws as a specimen on the harness
 * index too — the index mounts an entry bare, and a component that needs a parent to exist is
 * one nobody looks at.
 *
 * `selected` rather than a rule reaching up into the row: a scoped block may not style a
 * composed component from outside, so the row tells the mark what it is instead of restyling
 * it. `prototype-styles.test.ts`'s rule, and also just how Vue's scoping works.
 */
const props = withDefaults(defineProps<{
	asset?: CatalogueAsset;
	selected?: boolean;
}>(), {
	asset: () => ASSETS[0] as CatalogueAsset,
	selected: false,
});

const path = computed((): string =>
	props.asset.outline === null ? '' : markPath(props.asset.outline, 20, 2));
</script>

<template>
	<svg
		class="rp-al-mark"
		:class="[`rp-al-mark--${asset.shape}`, { 'rp-al-mark--on': selected }]"
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

<style scoped>
/*
 * FIVE STATES THAT DIFFER IN KIND, and getting there took a capture and two reviews.
 *
 * The first version drew an empty box for both absence states, told apart by a diagonal, and
 * put a slash across an unscaled outline. Photographed with all four on screen at once, three
 * of them were a square with a line through it: a measured 600 × 600 tile, an unscaled cabinet
 * and a not-yet-read cabinet were separated by stroke pattern in one case and by COLOUR alone
 * in the other — the exact failure this mark exists to avoid, shipped by the mark. Nothing in
 * jsdom could have said so, and reasoning about it did not either; the two collisions are
 * obvious the moment the shelf holding them is the one that happens to be open.
 *
 * So each state now differs from every other in KIND, never in weight:
 *
 * - `measured` — the outline, solid.
 * - `unscaled` — the SAME outline, dashed. The proportions are real and the scale is not, which
 *   is exactly what a provisional stroke over true geometry says.
 * - `pending` — three dots. Not a shape at all, so no footprint can collide with it, and it is
 *   already the printed mark for "still coming".
 * - `none` — nothing. An empty slot is the one thing no other state can be mistaken for, and a
 *   drawn box for "there is no shape" was only ever scaffolding pretending to be data.
 * - `unreadable` — a struck box. The sidecar is there and refused to parse, which is the one
 *   outcome the first four could not carry: `none` reports an absence that is false and
 *   `pending` loads forever. A box says something IS there and the cross says it is spent. It is
 *   the ONLY state that draws a box, so nothing can confuse it with a square footprint.
 * - `unreadable` — a struck box. The sidecar is there and refused to parse, which is the one
 *   outcome the first four could not carry: `none` would report an absence that is false and
 *   `pending` would load forever. A box says something IS there and the cross says it is spent,
 *   which is the printed vocabulary the rest of these marks are drawn in. It is the only state
 *   that draws a box at all, so nothing can be confused with a square footprint.
 *
 * The 20px column is held by the `<svg>` itself, which always renders. Removing the element for
 * `none` would let the grid pull every later slot one column left.
 */
.rp-al-mark {
	width: 20px;
	height: 20px;
	overflow: visible;
	fill: none;
	stroke: currentColor;
	stroke-width: 1;
	stroke-linejoin: round;
	color: var(--text-muted);
}

.rp-al-mark--unscaled {
	stroke-dasharray: 2 2;
}

/* The two quiet absences. Neither is told from the other by this weight — the dots are what say
   `pending` and their absence is what says `none`. */
.rp-al-mark--pending {
	color: var(--text-faint);
}

/* Not `--text-error`: the state is carried by the cross, and a colour on top of it would be a
   second channel rather than the only one. But a damaged file is worth an eye finding, so it
   keeps full-strength foreground where the two absences are faint. */
.rp-al-mark--unreadable {
	color: var(--text-normal);
}

.rp-al-mark--on {
	color: var(--text-normal);
}

.rp-al-mark__dot {
	fill: currentColor;
	stroke: none;
}
</style>
