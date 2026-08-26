<!--
	The filter bar of the Work Packages list, as a mock of its own rather than as markup
	inside `WorkPackages.vue`.

	It is a SEPARATE file because the list screen has to compose a sibling mock beside a real
	component, and because the two are promoted at different times: the list itself is the
	surface `docs/deliverables/Sitemap.md` records for V1, while filtering is the part a
	renovator only needs once a project has more packages than fit on a screen.

	**Why the trade filter is a row of buttons and not a dropdown.** The renovator's question
	on this screen is "what is the plumber waiting for", asked while standing in a room, so
	the trades are the primary axis and a dropdown hides the one thing worth seeing. The count
	sits at the end of the row rather than in the header, because it is a result of the filter
	rather than a property of the plan.

	**This is the first mock with a script and a style block of its own**, and it is what those
	two buy. The trades were five hand-copied `<button>` blocks, because a template-only file
	has no props and so no `v-for`; and nothing was interactive, because it had no state — the
	first tab was drawn as selected purely so the selected treatment appeared in a screenshot.
	Both were worked around rather than designed, and a reviewer looking at a static bar could
	not judge the one thing a filter bar is: what it does when you press it.

	The `<style scoped>` block does not ship — nothing imports this tree — which is the whole gain
	over a `styles/` partial for a screen that does not exist yet. What it costs is that the
	block does not travel either: promotion moves this file into `src/presentation/` and lifts
	the CSS into a partial, because a shipped component is styled from the assembled sheet that
	SDD §84's colour check runs over. The template and the script cross unchanged.
-->
<script setup lang="ts">
// A real import, exactly as a shipped component writes it — there is no auto-import here, and
// a mock that imports the way `src/presentation/` does is a mock that promotes as a file move.
import { ref } from 'vue';

/**
 * The trades, as data rather than as five copies of one block. A promoted component takes
 * this as a prop from the plan's own packages; a mock holds the shape it will be handed, so
 * that the promotion is a change of SOURCE and not of markup.
 */
const trades = ['All trades', 'Demolition', 'Plumbing', 'Electrical', 'Groundworks'] as const;

// The one piece of state a filter bar has. `aria-pressed` is bound from it rather than drawn,
// so what a reviewer presses in the harness is what a renovator will press in a vault.
const active = ref<string>(trades[0]);
</script>

<template>
	<div class="rp-wp-filters">
		<div
			class="rp-wp-filter-group"
			role="group"
			aria-label="Filter by trade"
		>
			<button
				v-for="trade in trades"
				:key="trade"
				type="button"
				class="rp-wp-filter"
				:class="{ 'rp-wp-filter--on': trade === active }"
				:aria-pressed="trade === active"
				@click="active = trade"
			>
				{{ trade }}
			</button>
		</div>
		<p class="rp-wp-filter-count">
			6 packages · 2 not started
		</p>
	</div>
</template>

<style>
.rp-wp-filters {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: var(--size-4-2);
	padding: 0 var(--size-4-4) var(--size-4-3);
	border-bottom: 1px solid var(--background-modifier-border);
}

.rp-wp-filter-group {
	display: flex;
	flex-wrap: wrap;
	gap: var(--size-4-1);
}

.rp-wp-filter {
	padding: var(--size-4-1) var(--size-4-2);
	font-size: var(--font-ui-smaller);
	color: var(--text-muted);
	background-color: transparent;
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-l);
	cursor: pointer;
}

.rp-wp-filter:hover {
	color: var(--text-normal);
	background-color: var(--background-modifier-hover);
}

/*
 * The selected trade. `aria-pressed` is the semantic channel and this is the visible one; the
 * rule keys on a class rather than on `[aria-pressed="true"]` so that it survives promotion
 * unchanged — the mock binds the state now, the component will compute it, and the CSS should
 * not have to change between those two.
 */
.rp-wp-filter--on {
	color: var(--text-on-accent);
	background-color: var(--interactive-accent);
	border-color: var(--interactive-accent);
}

.rp-wp-filter-count {
	margin: 0;
	font-size: var(--font-ui-smaller);
	color: var(--text-faint);
}
</style>
