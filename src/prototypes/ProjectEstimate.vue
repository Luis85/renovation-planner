<!--
	The project's estimated cost, as a `CalculatedValue` rather than as a number.

	It is a file of its own because the component library names it as one and because the
	contract it has to keep is specific: "`CalculatedValue` must expose provenance and cannot
	masquerade as a manually editable stored value." A figure that only prints an amount keeps
	neither half — it looks exactly like something you could type over, and it says nothing
	about where it came from.

	**This is the product's central claim rendered as a sentence.** `PRODUCT.md`'s positioning
	is that geometry produces the number: a marked area times a waste factor times a unit price
	is a quantity and a cost, and "the spatial object is not a picture of the plan; it is an
	input to it". So the derivation is printed under the figure. `canvas.css` reaches the same
	rule from the other side, about the planning meter — a bare percentage is "exactly the
	derived-value-that-is-not-derived the README caught in the areas", where four drawn zones
	turned out not to be solvable for any single scale and nobody noticed because nobody
	multiplies a polygon by hand.

	**Not a hero metric.** The craft floor refuses "big number, small label, supporting stats,
	accent" as a page scaffold, and the alternative is not a smaller number — it is a number
	that leads by weight and position while staying inside the host's own type scale. Every size
	here resolves to an Obsidian variable, per the concept's rule that a value the host declares
	is READ rather than restated.

	The two qualifiers are `concept.css`'s `.rp-badge`, whose `data-health="stale"` variant this
	screen needs by name. A label first and a mark second: the word carries the meaning, the
	border and the icon carry the hue, and neither is asked to work alone.
-->
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
	/** Already formatted in the PROJECT's currency, never the reader's — `PRODUCT.md`'s rule. */
	amount: string;
	requirements: number;
	rooms: number;
	/** Figures whose inputs have moved. They ARE in the amount, and the badge says so. */
	stale: number;
	/** Figures the total cannot take, because their currency is not the project's. */
	unsummable: number;
}>();

/**
 * Built from the same numbers the figure was built from, rather than written as copy, so a
 * fixture change cannot leave the derivation describing a total it no longer explains.
 */
const provenance = computed(
	() => `Summed from ${props.requirements} requirements across ${props.rooms} rooms.`,
);
</script>

<template>
	<section class="rp-estimate">
		<h3 class="rp-estimate__label">
			Estimated cost
		</h3>
		<p class="rp-estimate__value">
			{{ amount }}
		</p>
		<p class="rp-estimate__provenance">
			{{ provenance }}
		</p>
		<p
			v-if="stale > 0 || unsummable > 0"
			class="rp-estimate__flags"
		>
			<span
				v-if="stale > 0"
				class="rp-badge"
				data-health="stale"
			>
				<svg
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle
						cx="12"
						cy="12"
						r="9"
					/>
					<path d="M12 7v5l3 2" />
				</svg>
				{{ stale }} need recalculating
			</span>
			<span
				v-if="unsummable > 0"
				class="rp-badge"
				data-health="excluded"
			>
				<svg
					width="13"
					height="13"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<circle
						cx="12"
						cy="12"
						r="9"
					/>
					<path d="M5.6 5.6l12.8 12.8" />
				</svg>
				{{ unsummable }} in another currency, not counted
			</span>
		</p>
	</section>
</template>

<style scoped>
.rp-estimate {
	margin-bottom: var(--size-4-5);
}

.rp-estimate__label {
	margin: 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	font-weight: 400;
}

/*
 * `tabular-nums` because this figure sits above a column of counts that also use it, and a
 * money value redrawn after a recalculation must not reflow its own digits. The craft floor
 * names the numerals in tabular data as a browser default belonging to no design system;
 * `canvas.css` had already set it on both the meter and the counts.
 */
.rp-estimate__value {
	margin: var(--size-4-1) 0 0;
	color: var(--text-normal);
	font-size: var(--font-ui-large);
	font-weight: 600;
	font-variant-numeric: tabular-nums;
	line-height: 1.2;
}

.rp-estimate__provenance {
	max-width: 60ch;
	margin: var(--size-4-1) 0 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	line-height: 1.4;
}

.rp-estimate__flags {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-1);
	margin: var(--size-4-2) 0 0;
}

/*
 * `.rp-badge` is declared HERE and not merely referenced, which is the correction a capture
 * forced. `concept.css` defines it — but that sheet is a drawing in `docs/`, and the harness
 * serves the plugin's own assembled `/styles.css`, which has no such rule. So the first draft
 * reused a class that does not exist anywhere the code can see it and the badges rendered as
 * bare run-on text with an icon in front. **A class named in a concept sheet is not a class the
 * product has**, and the difference is invisible to every gate: nothing here reads `docs/`.
 *
 * The values are `concept.css`'s, so a promotion is a move into a `styles/` partial rather than
 * a redesign — and the split it records is kept: the label IS the component, so it stays at
 * full contrast, and the hue rides the border and the mark.
 */
.rp-badge {
	display: inline-flex;
	align-items: center;
	gap: var(--size-4-1);
	padding: 1px 6px 1px 5px;
	border: 1px solid currentcolor;
	border-radius: var(--radius-s);
	color: var(--text-normal);
	font-size: var(--font-ui-smaller);
	font-weight: 500;
	line-height: 1.5;
}

.rp-badge > svg {
	flex: 0 0 auto;
}

.rp-badge[data-health='stale'] {
	border-color: var(--text-warning);
}

.rp-badge[data-health='stale'] > svg {
	color: var(--text-warning);
}

/*
 * An excluded figure is not a warning — nothing is wrong with the project, the total simply
 * cannot take that row — so it does not get the warning hue, and this screen keeps that hue
 * meaning one thing.
 *
 * The treatment is `concept.css`'s `unknown` variant and the NAME deliberately is not. That
 * variant exists for the round-trip rule, where a value the plugin does not recognise renders
 * as itself; borrowing it here would have made one attribute mean two things and left the next
 * reader to work out which. Muted and dashed is right for both — the component cannot vouch for
 * the value either way — so what is shared is the treatment and what differs is the reason.
 */
.rp-badge[data-health='excluded'] {
	color: var(--text-muted);
	border-color: var(--text-muted);
	border-style: dashed;
}
</style>
