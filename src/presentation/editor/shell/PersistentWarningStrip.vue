<script setup lang="ts">
/**
 * Task 20's replacement for four independent `<p class="rp-editor-notice">` blocks, each
 * with its own `v-if`, in `PlanEditorRoot.vue`. ADDITIVE, never the in-place failure state —
 * see `editorWarnings`' own header and `PlanEditorRoot.vue`'s `warnings` slot comment for why:
 * the canvas is still showing valid data, only possibly stale, missing a background, or
 * missing some of its zones.
 *
 * **The live region is on `.rp-warning-strip`, the CONTAINER, never on an item.** It is
 * rendered unconditionally — no `v-if` guards it — so it exists in the document before any
 * warning does, which is what `docs/components/Toast.md`'s "explicitly not on a container
 * that appears" asks for and what a `role="status"` created together with its own text is
 * not: a live region and its first content landing in the DOM in the same tick often does not
 * announce. Each `<p class="rp-warning-strip__item">` therefore carries no role of its own —
 * the whole strip announces once, through the one region that was already there.
 *
 * `:key="w.id"` still matters, and for a narrower reason than "identity". Every warning here
 * already carries a stable id; what keying on it buys is that a warning which STAYS keeps its
 * own DOM node when a sibling arrives or leaves, rather than Vue reconciling by position and
 * tearing down and remounting every `<p>` below the one that changed.
 *
 * **R4/R5 (2026-09-04):** the region stays on the container; every item carries its severity
 * as a mark AND a word — `docs/components/Toast.md`'s "both, always, never one". Heading, busy
 * state and actions are not in the model: no warning has an action yet, and a field with no
 * producer is a self-declared shape.
 */
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { EditorWarning, WarningSeverity } from './warnings';

defineProps<{ warnings: readonly EditorWarning[] }>();

const SEVERITY_LABEL: Record<WarningSeverity, StringKey> = {
	warning: 'editor.warning.severity.warning',
	error: 'editor.warning.severity.error',
};
</script>

<template>
	<div
		class="rp-warning-strip"
		role="status"
	>
		<p
			v-for="w in warnings"
			:key="w.id"
			class="rp-warning-strip__item"
			:class="`rp-warning-strip__item--${w.severity}`"
			:data-rp-warning="w.id"
			:data-rp-severity="w.severity"
		>
			<span class="rp-warning-strip__severity">{{ tr(SEVERITY_LABEL[w.severity]) }}</span>
			{{ tr(w.messageKey, w.params) }}
		</p>
	</div>
</template>
