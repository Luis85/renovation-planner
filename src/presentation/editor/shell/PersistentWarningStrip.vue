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
 * as a mark AND a word — `docs/components/Toast.md`'s "both, always, never one".
 *
 * **Task 9 (the trust path, design spec §2.4/§2.8/§10) is what gives a row actions and a busy
 * state, and gives the container a focus-recovery duty.** A row's `aria-busy` and each of its
 * buttons' `aria-disabled` read the SAME per-action `busy` `editorWarnings` already computed —
 * a second busy flag here would be a second answer to the one question `ProjectStore.refreshing`
 * already settles. Buttons are `aria-disabled`, never `:disabled`, per this repository's own
 * "no control that does nothing" rule for a paused control: a click still fires, so `onClick`
 * (not the disabled attribute) is what actually withholds `run()` while busy.
 *
 * **Focus recovery is the add-room banner's own pattern, reached through a different door.**
 * `TemporaryToolBanner.vue` uses `watch(task, …)` because its root carries `v-if` on ITSELF, so
 * ending a task never fires that component's own `onBeforeUnmount` — the task ends by an
 * internal `v-if` flipping, not by the component's own teardown. This component's rows are
 * `v-for` children of the SAME component rather than separate components, so there is no
 * per-row unmount hook to reach for either way; what this component's OWN update cycle gives
 * instead is `onBeforeUpdate`/`onUpdated`, which bracket every re-render exactly the way
 * `onBeforeUnmount ` brackets the banner's — before the DOM is patched, and after. Driven
 * directly against a real mount before trusting it (a focused Try again button, `stale`
 * clearing, `document.activeElement` read back afterwards): the pair fires on every prop
 * change from the parent, which is the only reactive dependency this component has.
 */
import { onBeforeUpdate, onUpdated, ref } from 'vue';
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { EditorWarning, WarningSeverity } from './warnings';

defineProps<{ warnings: readonly EditorWarning[] }>();

const SEVERITY_LABEL: Record<WarningSeverity, StringKey> = {
	warning: 'editor.warning.severity.warning',
	error: 'editor.warning.severity.error',
};

const strip = ref<HTMLElement | null>(null);

/**
 * Captured BEFORE the patch that may remove the focused row's button, per this component's
 * own header. A plain module-scoped-in-setup boolean rather than a `ref`: nothing here reads
 * it reactively, it is only ever written in `onBeforeUpdate` and read in the `onUpdated` that
 * follows it in the same update cycle.
 */
let focusWasInsideStrip = false;

onBeforeUpdate(() => {
	focusWasInsideStrip = strip.value !== null && strip.value.contains(document.activeElement);
});

onUpdated(() => {
	// `document.activeElement === document.body` is what a browser (and jsdom, per the same
	// spec) falls back to when the element that HELD focus is removed from the document —
	// the signature of "the row this was inside just disappeared", as opposed to "the row is
	// still there and simply re-rendered", which leaves the same element focused and this
	// condition false.
	if (focusWasInsideStrip && document.activeElement === document.body) {
		strip.value?.focus();
	}
});
</script>

<template>
	<div
		ref="strip"
		class="rp-warning-strip"
		role="status"
		tabindex="-1"
	>
		<p
			v-for="w in warnings"
			:key="w.id"
			class="rp-warning-strip__item"
			:class="`rp-warning-strip__item--${w.severity}`"
			:data-rp-warning="w.id"
			:data-rp-severity="w.severity"
			:aria-busy="w.actions?.some((a) => a.busy) ? 'true' : undefined"
		>
			<span class="rp-warning-strip__severity">{{ tr(SEVERITY_LABEL[w.severity]) }}</span>
			{{ tr(w.messageKey, w.params) }}
			<span
				v-if="w.actions !== undefined"
				class="rp-warning-strip__actions"
			>
				<button
					v-for="a in w.actions"
					:key="a.id"
					type="button"
					class="rp-warning-strip__action"
					:data-rp-action="a.id"
					:aria-disabled="a.busy ? 'true' : undefined"
					@click="a.busy ? undefined : a.run()"
				>{{ tr(a.labelKey) }}</button>
			</span>
		</p>
	</div>
</template>
