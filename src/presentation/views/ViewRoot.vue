<script setup lang="ts">
/**
 * The Vue root of the Renovation Project view — one isolated app per Obsidian `ItemView`
 * (ADR-004, SDD §12).
 *
 * It draws nothing yet, and that is the increment's success criterion rather than an
 * omission: "an empty Renovation Planner view opens reliably inside Obsidian". What this
 * proves is the LIFECYCLE — mount on open, unmount on close — before slice 5 gives it a
 * canvas to draw.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one, because Obsidian's
 * marketplace rejects inline styles and this plugin's CSS lives in `styles/`, assembled
 * into one sheet. The class below is that sheet's only entry point into this view.
 *
 * Slice 15's `DialogHost` mounts here too, not only in the Plan Editor: slice 14's
 * "Create a project" empty-state action opens a dialog from THIS view, and a host that
 * only ever mounted beside a `PlanCanvas` would leave that click with nothing to open.
 */
import DialogHost from '../dialogs/DialogHost.vue';
</script>

<template>
	<div class="renovation-planner-view">
		<DialogHost />
	</div>
</template>
