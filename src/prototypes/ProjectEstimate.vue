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
 * this component — a total with both qualifiers live — and `ProjectHome.vue` overrides all six.
 *
 * The content is invented and `PRODUCT.md` requires it to be labelled as such: there is no real
 * renovation project, floor plan or cost data anywhere in this repository.
 */
const props = withDefaults(
	defineProps<{
		/**
		 * Already formatted in the PROJECT's currency, never the reader's — `PRODUCT.md`'s rule.
		 *
		 * **`null` when `ProjectSummary.total` is `null`**, which means the project's currency
		 * could not be resolved at all — the one state in which no figure can honestly be
		 * printed. A currency is the denominator of every amount here, so this is not "zero" and
		 * not "unknown yet": there is nothing a number could mean.
		 *
		 * The region draws an em dash and a REASON in place of both the figure and the
		 * provenance sentence, because provenance is a claim about where an amount came from and
		 * there is no amount. Rendering the sentence under a blank value is the misleading
		 * half — worse than the blank, since it describes inputs to a total nobody computed.
		 */
		amount?: string | null;
		requirements?: number;
		/**
		 * The rows that actually CONTRIBUTED to `amount`, supplied rather than derived.
		 *
		 * The first version computed `requirements - unsummable`, which was right for exactly
		 * one exclusion category and broke the moment a second arrived: with `foreign` rows also
		 * excluded it over-claimed, and subtracting both double-counts a row that is BOTH
		 * foreign and currency-mismatched — the exclusion counts are independent, which this
		 * design states in so many words and the arithmetic then ignored. Only the query knows
		 * the size of the union, so only the query can answer this.
		 */
		summed?: number;
		/**
		 * `null` when the project-scoped zone walk REFUSED — an unreadable geometry sidecar,
		 * which `ObsidianZoneRepository.list` propagates rather than counting per note. The
		 * provenance sentence drops its rooms clause rather than printing a number it does not
		 * have; `across null rooms` and `across 0 rooms` are both statements this component is
		 * not entitled to make.
		 *
		 * This docblock used to carry the paragraph now sitting on `flags` below, which
		 * described the removed foreign-rows badge and had nothing to do with `rooms` — a
		 * docblock orphaned by the edit that deleted what it described, which is the defect
		 * `CLAUDE.md` names and nothing in any gate reads.
		 */
		rooms?: number | null;
		/**
		 * Stale rows a recalculation could actually fix — SUPPLIED, not derived here.
		 *
		 * This was `stale - unreadableReferents`, which was right for one obstacle and wrong the
		 * moment a second existed: a row whose asset or zone was DELETED carries `missingTarget`
		 * rather than an unreadable referent, and `RecalculateRequirementCommand` refuses it with
		 * `requirement.asset-gone` / `requirement.zone-gone`. Subtracting both counts instead
		 * would double-count a row that is both, which is a union only the query can size — the
		 * same argument `summed` carries, and the same mistake one field over.
		 */
		recalculable?: number;
		/**
		 * Rows built from a referent note that could not be READ — a subset of `stale`, since a
		 * figure whose inputs cannot be re-read is never reported current. A STATE, like every
		 * count here: whether such a row reached the amount is `unsummable`'s question, not this
		 * one's, and a row that is both is excluded like any other currency mismatch.
		 *
		 * Separated from `stale` because recalculating them cannot succeed.
		 */
		unreadableReferents?: number;
		/**
		 * Rows whose asset or zone was DELETED — the other thing a recalculation cannot fix, and
		 * a separate badge because it points somewhere else: a note that could not be READ points
		 * at diagnostics, a target that is GONE points at reassigning or deleting the row.
		 *
		 * Introducing `recalculable` took these rows out of "needs recalculating", correctly, and
		 * left them with no qualifier at all while their cost stayed in the amount. Removing a
		 * false claim is not the same as reporting the truth.
		 */
		missingTargets?: number;
		/**
		 * Stale rows a recalculation cannot fix for a reason that is NOT an unreadable referent
		 * and NOT a deleted one — a readable, present asset hand-edited from an area unit to a
		 * length, a degenerate polygon, a currency the project no longer uses.
		 *
		 * **It exists because narrowing `recalculable` created a category with no qualifier**,
		 * which is the second time in this component's life: `missingTargets` was minted for
		 * exactly that reason when `recalculable` first appeared, and its own docblock says
		 * "removing a false claim is not the same as reporting the truth". Defining
		 * `recalculable` from the command's whole precondition set took MORE rows out of "needs
		 * recalculating" — correctly — and those rows then belonged to no badge at all while
		 * their persisted cost went on contributing to the amount.
		 *
		 * A separate badge rather than a widened one, for the reason every other split here
		 * gives: it points somewhere different. Unreadable points at diagnostics, deleted points
		 * at reassigning, and this points at the note whose own values are inconsistent.
		 */
		blocked?: number;
		/** Figures the total cannot take, because their currency is not the project's. */
		unsummable?: number;
	}>(),
	{
		amount: '€42,300.00',
		requirements: 24,
		summed: 23,
		rooms: 11,
		recalculable: 1,
		unreadableReferents: 1,
		missingTargets: 1,
		blocked: 1,
		unsummable: 1,
	},
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
/**
 * `null` when there is no amount to have provenance FOR. The template branches on this rather
 * than on `amount`, so the two can never disagree about whether a figure exists.
 */
const provenance = computed(() => {
	if (props.amount === null) return null;
	const inputs =
		props.summed < props.requirements
			? `${props.summed} of ${props.requirements} requirements`
			: `${props.requirements} requirements`;
	// The rooms clause is DROPPED rather than defaulted when the room count is withheld: a
	// provenance line is the one place in this component that may not round an unknown to a
	// number, since saying where a figure came from is its whole job.
	return props.rooms === null
		? `Summed from ${inputs}.`
		: `Summed from ${inputs} across ${props.rooms} rooms.`;
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
/**
 * Number agreement is done inline here, and that is a PROTOTYPE affordance rather than the
 * shipped answer. A capture read "1 need recalculating" and "1 reference something deleted" —
 * both wrong, both invisible to every gate, since jsdom is perfectly happy with bad grammar.
 *
 * Promotion cannot copy this: `t` takes interpolation parameters (slice 19) and has no PLURAL
 * mechanism at all, so a real implementation needs either two keys per message or a plural rule
 * in the locale layer — and German, which this plugin ships, does not have the same plural
 * categories as English. That is a decision for whoever promotes these strings, and naming it
 * here is cheaper than letting the ternaries travel into `en.ts` as though they were the design.
 */
const flags = computed(() => {
	// **Only the rows a recalculation could actually fix**, which is a count the QUERY supplies
	// rather than one this component derives. `stale` includes both obstacles — an unreadable
	// referent and a DELETED one — and printing the whole stale count offers a remedy that
	// cannot be applied, which is slice 14's live-control-that-does-nothing rule as copy.
	// The PREDICATES are data too, not just the rows. Three `if` blocks pushing into an array
	// put this function over fallow's CRAP threshold the moment a third condition arrived — a
	// prototype has no test coverage, so cyclomatic complexity squares — and the file's own
	// argument for collapsing the badges into data applies unchanged to the questions that
	// select them.
	return [
		{
			when: props.recalculable > 0,
			health: 'stale',
			key: 'stale',
			d: 'M12 7v5l3 2',
			text: `${props.recalculable} ${props.recalculable === 1 ? 'needs' : 'need'} recalculating`,
		},
		{
			// Stale, in the amount, and NOT offered the remedy above — so it needs a sentence of
			// its own or the total reads as current for these rows. Deliberately does not name a
			// remedy: the causes differ (a unit, a degenerate area, a currency), and one of them
			// dressed as the general case is the wrong instruction three times out of four.
			when: props.blocked > 0,
			health: 'stale',
			key: 'blocked',
			d: 'M7 12h10',
			text: `${props.blocked} cannot be recalculated`,
		},
		{
			// Points at the diagnostics door rather than at a remedy. WHICH note failed is
			// deliberately not named: the diagnostics ledger already records it, and a second
			// copy here would be a second answer to one question.
			when: props.unreadableReferents > 0,
			health: 'excluded',
			key: 'unreadable',
			d: 'M12 8v4m0 3.5v.5',
			text: `${props.unreadableReferents} could not be read — see diagnostics`,
		},
		{
			when: props.missingTargets > 0,
			health: 'excluded',
			key: 'missing',
			d: 'M8 8l8 8m0-8l-8 8',
			text: `${props.missingTargets} ${props.missingTargets === 1 ? 'references' : 'reference'} something deleted`,
		},
		{
			// The two above survive `amount === null` and this one does not, which is the
			// spec's own state-versus-exclusion split applied to copy. They describe the ROWS,
			// and the rows are in those states whether or not a total could be computed. "Not
			// counted" describes EXCLUSION FROM A TOTAL, and with no total nothing was counted
			// or not counted — so it would qualify a figure the region has just declined to
			// print. Found by capturing the no-total state and looking: all three rendered.
			when: props.amount !== null && props.unsummable > 0,
			health: 'excluded',
			key: 'currency',
			d: 'M5.6 5.6l12.8 12.8',
			text: `${props.unsummable} in another currency, not counted`,
		},
	].filter((flag) => flag.when);
});
</script>

<template>
	<section class="rp-estimate">
		<h3 class="rp-estimate__label">
			Estimated cost
		</h3>
		<p class="rp-estimate__value">
			{{ amount ?? '—' }}
		</p>
		<p
			v-if="provenance !== null"
			class="rp-estimate__provenance"
		>
			{{ provenance }}
		</p>
		<!--
			The reason stands where the provenance sentence would have. It is a sentence rather
			than a badge because the badges qualify a figure that EXISTS, and this state has
			none to qualify — putting it in the badge row would file "there is no total" beside
			"1 in another currency, not counted" as though they were the same kind of remark.
		-->
		<p
			v-else
			class="rp-estimate__provenance"
		>
			No total: this project's currency could not be read.
		</p>
		<p
			v-if="flags.length > 0"
			class="rp-estimate__flags"
		>
			<span
				v-for="flag in flags"
				:key="flag.key"
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
