<!--
	The empty state, drawn before it is built (design slice 14, PRD §94).

	Scripted rather than template-only, because promotion is then a plain file move: every
	shipped component has a script block, and this one needs props and a conditional button
	the moment it is more than a picture. The props here are the real contract — RESOLVED
	strings, never i18n keys, so the component stays reusable by a future Budget or Schedule
	view that has its copy from somewhere else.

	Two forms, one panel: block for a whole pane, `--overlay` for the Plan Editor, where the
	canvas stays mounted underneath. `styles/empty-state.css` carries both and ships, which
	is why there is no style block here — a scoped block would neither ship nor travel at
	promotion, and this file is written to be moved.

	The defaults below are what the index renders it with; the real caller passes props.
-->
<script setup lang="ts">
withDefaults(
	defineProps<{
		headline?: string;
		body?: string;
		actionLabel?: string;
		overlay?: boolean;
	}>(),
	{
		headline: 'No zones yet',
		body: 'Draw the first zone on this plan to start measuring areas and costs.',
		actionLabel: 'Draw a zone',
		overlay: false,
	},
);
</script>

<template>
	<div
		class="rp-empty-state"
		:class="{ 'rp-empty-state--overlay': overlay }"
	>
		<div class="rp-empty-state__panel">
			<div class="rp-empty-state__icon">
				<slot name="icon" />
			</div>
			<h2 class="rp-empty-state__headline">
				{{ headline }}
			</h2>
			<p class="rp-empty-state__body">
				{{ body }}
			</p>
			<button
				v-if="actionLabel !== undefined"
				type="button"
				class="rp-empty-state__action"
			>
				{{ actionLabel }}
			</button>
		</div>
	</div>
</template>
