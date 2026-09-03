<!--
	What this project contains, as a row of facts rather than a row of tiles.

	It follows `canvas.css`'s `.rc-counts`: a hairline grid whose container background shows
	through 1px gaps, `tabular-nums` on the values, and a zero that DIMS rather than colours —
	"a count of zero is not the same shape as a count of eight, and the difference has to survive
	without colour".

	**One rule of that component is deliberately not followed yet.** `canvas.css` makes each cell
	a control, on the grounds that a count is "navigation to a filtered list". Here only Plans has
	a destination built, and a capture settled it: mixing a `<button>` cell with two `<div>` ones
	drew two different backgrounds in one grid, because Obsidian styles every button. The uniform
	answer is right for a second reason — the destination a Plans cell would navigate to is the
	Design tab three centimetres above it, and a count that duplicates an adjacent route is a
	second door to one room rather than navigation.

	They become controls when Rooms and Requirements have somewhere to go. The concept's rule is
	waiting for them, and so is the `align-items` trap recorded in the CSS below.

	Extracted out of `ProjectHome.vue` when that file crossed its 400-line cap. A budget bought
	back by reformatting is a budget already spent, so this is a seam rather than a shave — and
	`canvas.css` had already named this a component of its own.
-->
<script setup lang="ts">
/**
 * Defaults on every prop, because `IndexPage.vue` renders a discovered entry as a bare
 * `<component :is>` with no props: a component requiring any photographs the harness index's own
 * failure card instead of itself. The same constraint `ProjectEstimate` records.
 */
withDefaults(
	defineProps<{
		counts?: readonly { readonly label: string; readonly value: number | null }[];
	}>(),
	{
		counts: () => [
			{ label: 'Plans', value: 2 },
			{ label: 'Rooms', value: 11 },
			{ label: 'Requirements', value: 24 },
		],
	},
);

/**
 * A WITHHELD count is an em dash, and it is not the same picture as a zero.
 *
 * `ProjectSummary.zoneCount` is `number | null`: `null` means the project-scoped zone walk
 * REFUSED — an unreadable geometry sidecar is one shared failure that
 * `ObsidianZoneRepository.list` propagates rather than blaming every zone in the plan — so no
 * room count can honestly be printed. Drawing the dimmed zero a genuinely empty project gets
 * would state exactly what the query declined to state, and `?? 0` at this interpolation reads
 * identically to a reader while doing it.
 *
 * `data-empty` deliberately stays FALSE for a withheld value. That attribute drives the dim,
 * which means "there are none of these"; a withheld count is not a claim about how many there
 * are. Verified by capture at 460px rather than by reading: the dash renders at full weight
 * beside the dimmed label, which is the distinction this rule exists to draw.
 */
const display = (value: number | null): string => (value === null ? '—' : String(value));
</script>

<template>
	<div class="rp-counts">
		<div
			v-for="count in counts"
			:key="count.label"
			class="rp-counts__cell"
			:data-empty="count.value === 0"
			:data-withheld="count.value === null"
		>
			<span class="rp-counts__value">{{ display(count.value) }}</span>
			<span class="rp-counts__label">{{ count.label }}</span>
		</div>
	</div>
</template>

<style scoped>
/*
 * The container's own background shows through 1px gaps as hairlines, so three cells share two
 * rules rather than each carrying a border that doubles at every seam.
 */
.rp-counts {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
	gap: 1px;
	margin-bottom: var(--size-4-4);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	background: var(--background-modifier-border);
	overflow: hidden;
}

/*
 * `align-items: flex-start` is kept even though these are `div`s. app.css sets
 * `align-items: center` on every `button`, and on a `flex-direction: column` button that is the
 * HORIZONTAL axis, so the value and the label centre themselves as flex items and their own
 * `text-align` has nothing left to align — `canvas.css` records it as the third instance of that
 * trap. Kept because a cell becomes a button again the day Rooms has a destination, and a rule
 * that has to be remembered at that moment is a rule that will not be.
 */
.rp-counts__cell {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 1px;
	padding: var(--size-4-2);
	border: 0;
	border-radius: 0;
	background: var(--background-secondary);
	box-shadow: none;
	color: var(--text-normal);
	text-align: left;
}

.rp-counts__value {
	font-size: var(--font-ui-medium);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	line-height: 1.2;
}

.rp-counts__label {
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}

/* A count of zero dims and stops inviting a click it has nothing to show. */
.rp-counts__cell[data-empty='true'] .rp-counts__value {
	color: var(--text-muted);
	font-weight: 400;
}
</style>
