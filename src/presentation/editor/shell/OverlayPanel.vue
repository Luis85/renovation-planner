<script setup lang="ts">
/**
 * The constrained layout's Layers overlay (design spec §5.1/§5.5): the container the
 * PERSISTENT property panel slides into when the pane is too narrow to give it a column of
 * its own. It holds no content of its own — `ResponsiveEditorShell` passes the very same
 * `<PropertyLayerPanel>` the full layout renders, so there is one panel component and two
 * places it can live rather than two panels that can disagree.
 *
 * **No focus trap, and that is the spec's decision rather than an omission** (§5.5): this is
 * not a dialog, nothing goes `inert`, and the canvas behind it stays reachable by Tab. What it
 * does own is Escape, and `.stop` says that this key is CONSUMED here — closing the overlay is
 * the whole of what it means while one is open. Measured rather than assumed: the canvas's own
 * Escape branch (`EditorSurface.onKeyDown`, which cancels the active tool's gesture) is bound to
 * the canvas ELEMENT, a sibling of this one, so nothing routes there by bubbling today and the
 * modifier changes no behaviour now. It is what keeps that true the day an ancestor listens —
 * the same rule `AddMenu` states for its own root, where the nesting made it load-bearing from
 * the first commit.
 *
 * `tabindex="-1"` plus a `focus()` on mount is what makes that key arrive at all: the rail
 * button that opened this overlay is still the focused element otherwise, and a key pressed
 * there bubbles through the rail, not through this container. Focus goes BACK to that button
 * when the overlay closes, which the shell does — it is the one place that knows which rail
 * button stands for which overlay.
 *
 * It carries no heading. `PropertyLayerPanel` brings its own `<h2>` and its own `aria-label`,
 * so a second one here would double the region's name and put a heading level in front of the
 * one the full layout already renders.
 */
import { onMounted, ref } from 'vue';
import { tr } from '../../i18n/strings';

const emit = defineEmits<{ close: [] }>();

const container = ref<HTMLElement | null>(null);

onMounted(() => {
	// Cast rather than optional-chained, the same guarantee `AddMenu`'s own casts state: this
	// names the component's own root element, bound before `onMounted` runs, so there is
	// nothing for a null branch to decide.
	(container.value as HTMLElement).focus();
});
</script>

<template>
	<div
		ref="container"
		class="rp-overlay-panel"
		tabindex="-1"
		@keydown.esc.stop="emit('close')"
	>
		<button
			type="button"
			class="rp-overlay-panel__close"
			@click="emit('close')"
		>
			{{ tr('editor.overlay.close') }}
		</button>
		<slot />
	</div>
</template>
