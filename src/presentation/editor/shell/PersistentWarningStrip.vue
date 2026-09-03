<script setup lang="ts">
/**
 * Task 20's replacement for four independent `<p class="rp-editor-notice">` blocks, each
 * with its own `v-if`, in `PlanEditorRoot.vue`. ADDITIVE, never the in-place failure state —
 * see `editorWarnings`' own header and `PlanEditorRoot.vue`'s `warnings` slot comment for why:
 * the canvas is still showing valid data, only possibly stale, missing a background, or
 * missing some of its zones.
 *
 * `:key="w.id"` is the whole point of the collection over the four separate blocks it
 * replaced: it is what keeps one warning's identity — and its live region — stable when a
 * sibling warning arrives or clears, rather than every remaining `<p>` being torn down and
 * remounted because Vue had only position to key them by.
 */
import { tr } from '../../i18n/strings';
import type { EditorWarning } from './warnings';

defineProps<{ warnings: readonly EditorWarning[] }>();
</script>

<template>
	<div class="rp-warning-strip">
		<p
			v-for="w in warnings"
			:key="w.id"
			class="rp-warning-strip__item"
			role="status"
			:data-rp-warning="w.id"
		>
			{{ tr(w.messageKey, w.params) }}
		</p>
	</div>
</template>
