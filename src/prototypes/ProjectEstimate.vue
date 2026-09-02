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

/**
 * Every prop carries a DEFAULT, and that is a harness constraint rather than a convenience.
 * `IndexPage.vue` renders a discovered entry as a bare `<component :is>` with no props at all,
 * so a component that requires any would photograph the index's own failure card instead of
 * itself — the reason `CLAUDE.md` records for `ProjectDetail.vue` and `PlanList.vue`, which are
 * reachable in the harness only through `?project=<id>`.
 *
 * A specimen that cannot be opened on its own is one nobody looks at, and the badges are
 * exactly the part an eye has to settle: whether four silhouettes and two border treatments
 * read apart is not a question any gate here can answer. So the defaults are a real state of
 * this component — a total with both qualifiers live — and `ProjectHome.vue` overrides all five.
 *
 * The content is invented and `PRODUCT.md` requires it to be labelled as such: there is no real
 * renovation project, floor plan or cost data anywhere in this repository.
 */
const props = withDefaults(
	defineProps<{
		/** Already formatted in the PROJECT's currency, never the reader's — `PRODUCT.md`'s rule. */
		amount?: string;
		requirements?: number;
		rooms?: number;
		/** Figures whose inputs have moved. They ARE in the amount, and the badge says so. */
		stale?: number;
		/** Figures the total cannot take, because their currency is not the project's. */
		unsummable?: number;
	}>(),
	{ amount: '€42,300.00', requirements: 24, rooms: 11, stale: 3, unsummable: 1 },
);

/**
 * Built from the same numbers the figure was built from, rather than written as copy, so a
 * fixture change cannot leave the derivation describing a total it no longer explains.
 *
 * **It names the rows actually SUMMED, not the rows reached**, which is the correction a review
 * caught and the one this line could least afford to get wrong. `Summed from 24 requirements`
 * beside a badge reading `1 in another currency, not counted` is a sentence contradicting the
 * badge under it — and provenance is the entire job of this component, so a provenance line that
 * overstates its own inputs is worse than none. With every row counted it stays the plain
 * sentence; with any excluded it says `23 of 24`, and the badge then explains the gap.
 */
const provenance = computed(() => {
	const summed = props.requirements - props.unsummable;
	const inputs =
		props.unsummable > 0
			? `${summed} of ${props.requirements} requirements`
			: `${props.requirements} requirements`;
	return `Summed from ${inputs} across ${props.rooms} rooms.`;
});

/**
 * The qualifiers as DATA rather than as two hand-copied `<span>` blocks — `npm run analyze`
 * reported the pair as a 19-line clone group, correctly.
 *
 * They collapse this cleanly because both marks are the same drawing: a ring, plus one stroke
 * inside it. That family resemblance is deliberate — a clock hand for a figure whose inputs
 * have moved, a slash for one the total cannot take — so the only thing that varies is `d`, and
 * a shared `<circle>` is a fact about the icon set rather than an accident of the collapse.
 */
const flags = computed(() => {
	const rows: { health: string; d: string; text: string }[] = [];
	if (props.stale > 0) {
		rows.push({
			health: 'stale',
			d: 'M12 7v5l3 2',
			text: `${props.stale} need recalculating`,
		});
	}
	if (props.unsummable > 0) {
		rows.push({
			health: 'excluded',
			d: 'M5.6 5.6l12.8 12.8',
			text: `${props.unsummable} in another currency, not counted`,
		});
	}
	return rows;
});
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
			v-if="flags.length > 0"
			class="rp-estimate__flags"
		>
			<span
				v-for="flag in flags"
				:key="flag.health"
				class="rp-badge"
				:data-health="flag.health"
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
					class="rp-badge__mark"
					aria-hidden="true"
				>
					<circle
						cx="12"
						cy="12"
						r="9"
					/>
					<path :d="flag.d" />
				</svg>
				{{ flag.text }}
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

/*
 * The mark carries a class rather than being selected as `svg`. `prototype-styles.test.ts`
 * refuses an element SUBJECT, and its reason is specific: Vue applies a parent's scope
 * attribute to a composed child's ROOT element, so a bare element subject is the shape that
 * restyles a real component by accident. A class of the mock's own is a thing no real component
 * has.
 */
.rp-badge__mark {
	flex: 0 0 auto;
}

.rp-badge[data-health='stale'] {
	border-color: var(--text-warning);
}

.rp-badge[data-health='stale'] .rp-badge__mark {
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
