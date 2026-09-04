<script setup lang="ts">
/**
 * The constrained layout's Inspector drawer (design spec §5.1/§5.5) — `OverlayPanel`'s
 * counterpart on the other edge, holding the same `<EntityInspector>` the full layout renders
 * in its own column.
 *
 * A SECOND component rather than one container with a `side` prop, because the two are what
 * the shell's two branches name: the one-overlay rule is expressed as `overlay === 'layers'`
 * against `overlay === 'inspector'`, and a shared container parameterised by side would put
 * that same decision in a prop as well as in the `v-if` that renders it. Everything they share
 * — Escape closing without a focus trap, `tabindex="-1"` focused on mount so the key arrives,
 * a labelled close button, the shell returning focus to the rail button — is written out in
 * `OverlayPanel.vue`'s header, which is the one to read; only the edge and the class differ.
 */
import { onMounted, ref } from 'vue';
import { tr } from '../../i18n/strings';

const emit = defineEmits<{ close: [] }>();

const container = ref<HTMLElement | null>(null);

onMounted(() => {
	(container.value as HTMLElement).focus();
});
</script>

<template>
	<div
		ref="container"
		class="rp-inspector-drawer"
		tabindex="-1"
		@keydown.esc.stop="emit('close')"
	>
		<button
			type="button"
			class="rp-inspector-drawer__close"
			@click="emit('close')"
		>
			{{ tr('editor.overlay.close') }}
		</button>
		<slot />
	</div>
</template>
