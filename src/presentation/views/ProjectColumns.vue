<script setup lang="ts">
/**
 * The `Projects` group's own header — its heading, and P00's wide-width column strip under it.
 *
 * **Extracted because `ProjectList.vue` was AT its 400-line budget when this strip arrived**,
 * which is the same seam `project-list.css` has taken three times and for the same reason: the
 * cap turns "add one more region" into "give the region a file", and this is the newest and
 * most self-contained one on the surface. It reads nothing from the list and the list reads
 * nothing back — it takes no props at all.
 *
 * **THE STRIP IS PRESENTATIONAL CHROME, NOT A TABLE.** The rows stay `<button>`s in a `<ul>`:
 * a `<table>` or a `role="grid"` would replace §7's roving-tabindex keyboard model with a grid
 * one, which P00's own image clarifications refuse in so many words ("the wide arrangement
 * prescribes no new table/keyboard model"). So this is a `<div>` of five spans sharing the
 * rows' grid template through one custom property (`--rp-project-columns`,
 * `styles/project-row.css`), and `aria-hidden` keeps it out of the accessibility tree — each
 * row's accessible name already carries its own facts in order, and a heading announced before
 * every row would be noise.
 *
 * It is DROPPED below the container threshold (`project-list-narrow.css`), where the rows are
 * no longer columns for it to head (P06: "No forced five columns").
 *
 * The `<h3>` comes with it because §11 asks for one per group heading and it is the same
 * region; moving it changes nothing a reader or a screen reader can observe, since the element
 * and its class are unchanged.
 */
import { tr } from '../i18n/strings';

/**
 * The five headings, in track order. A literal array rather than five spans in the template:
 * the spans differ only by key, and `tr` refuses anything that is not a declared `StringKey`,
 * so a mistyped one fails the build rather than rendering its own name.
 */
const COLUMNS = [
	'view.project.column-project',
	'view.project.column-plans',
	'view.project.column-currency',
	'view.project.column-status',
	'view.project.column-last-worked',
] as const;
</script>

<template>
	<h3 class="rp-project-list__group-title">
		{{ tr('view.project.group.projects') }}
	</h3>
	<div
		class="rp-project-list__columns"
		aria-hidden="true"
	>
		<span
			v-for="column in COLUMNS"
			:key="column"
			class="rp-project-list__column"
		>{{ tr(column) }}</span>
	</div>
</template>
