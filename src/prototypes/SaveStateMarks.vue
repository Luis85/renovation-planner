<!--
	Every save state's MARK, side by side, because three of the four cannot be reached in the
	harness any other way.

	`SaveStateIndicator` is itself a harness entry, but it reads `SaveStateStore` and a
	standalone mount rests at `saved` — so a capture of the real component shows one mark and
	says nothing about the other three. That matters more here than usual: the finding that
	produced these marks was that the states are not recognizable at a glance, and "the marks
	are distinct" is a claim only an eye can settle. jsdom resolves no CSS, so the suite can
	assert that a rule EXISTS (`saveStateIndicator.test.ts`) and never that two rules look
	different.

	`unsaved-changes` is unreachable through the store's action surface at all (design slice
	13, Definition of Done item 10), so this is the only place its mark is ever drawn.

	**This duplicates the real component's markup, which is a cost and not an oversight.** A
	mock cannot drive a store, and widening the component with a state prop to make it
	photographable would be changing shipped code to suit the tool. The duplication is two
	class names deep, and both are declared by the shipped stylesheet — the one home that
	ships — so a renamed class breaks the picture rather than silently drawing the wrong thing.
	`tests/build/prototype-promotion.test.ts` is scoped to the `ZoneSummary` pair and does not
	hold this file against anything; nothing here is intended for promotion.

	Two things this file learned by being added, both from gates rather than from review.
	It does NOT mirror the component's `rp-save-state-label` class, because
	`tests/build/prototype-styles.test.ts` refuses a class no stylesheet declares and that one
	is declared nowhere — a dead hook on the shipped component, left alone here because
	removing it is not this change's business and a user's CSS snippet may key on it. And the
	prose above must not put the word "from" directly before a backticked stylesheet path:
	`tests/harness/harness.test.ts` scans every module the harness can reach for a CSS import,
	its regex accepts a backtick as the quote, and this comment matched it — the
	guard-fires-on-its-own-explanation defect that test's own header names for two other files.
-->
<template>
	<ul class="rp-save-state-marks">
		<li
			v-for="state in ['saved', 'saving', 'unsaved-changes', 'save-error']"
			:key="state"
			:class="`rp-save-state-${state}`"
		>
			<span
				class="rp-save-state-mark"
				aria-hidden="true"
			/>{{ state }}
		</li>
	</ul>
</template>

<style scoped>
/*
	Layout for the specimen only — `scoped` because Vite never removes an injected block, so
	an unscoped one would go on styling the index after the designer opened something else.
	The marks themselves are drawn by the shipped stylesheet and by nothing here, which is
	what makes the picture worth taking.
*/
.rp-save-state-marks {
	display: flex;
	flex-direction: column;
	gap: var(--size-4-2);
	margin: 0;
	padding: var(--size-4-4);
	list-style: none;
	font-size: var(--font-ui-smaller);
}
</style>
