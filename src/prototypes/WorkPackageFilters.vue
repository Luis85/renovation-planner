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

	Nothing here is interactive: a template-only mock has no script block, so `aria-pressed`
	states are drawn rather than bound. The first tab is drawn as the selected one so the
	selected treatment is visible in a screenshot at all.
-->
<template>
	<div class="rp-wp-filters">
		<div
			class="rp-wp-filter-group"
			role="group"
			aria-label="Filter by trade"
		>
			<button
				type="button"
				class="rp-wp-filter rp-wp-filter--on"
				aria-pressed="true"
			>
				All trades
			</button>
			<button
				type="button"
				class="rp-wp-filter"
				aria-pressed="false"
			>
				Demolition
			</button>
			<button
				type="button"
				class="rp-wp-filter"
				aria-pressed="false"
			>
				Plumbing
			</button>
			<button
				type="button"
				class="rp-wp-filter"
				aria-pressed="false"
			>
				Electrical
			</button>
			<button
				type="button"
				class="rp-wp-filter"
				aria-pressed="false"
			>
				Groundworks
			</button>
		</div>
		<p class="rp-wp-filter-count">
			6 packages · 2 not started
		</p>
	</div>
</template>
