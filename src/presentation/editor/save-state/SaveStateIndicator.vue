<script setup lang="ts">
/**
 * §60's third status-bar region: "is this Plan's data safely written?".
 *
 * **A mark AND a word, which is what `docs/components/Save-state indicator.md` asks for and
 * what the first version of this component did not give.** That version rendered the word
 * alone, with a colour on two of the four states, under a docblock citing SDD §85's
 * "status not colour-only" rule — and it satisfied that rule, since a word is not a colour.
 * The component spec is stricter and says why: "the temptation to ship a coloured dot is
 * strongest [here], because the dot works perfectly for the author who built it". A word
 * alone is the same trade made in the other direction — correct, and unreadable at a glance
 * in a status bar nobody is looking at.
 *
 * The mark is `aria-hidden` and carries NO text, so the word remains the whole accessible
 * name and `wrapper.text()` still equals exactly the label. Everything it draws is CSS in
 * `styles/editor-status.css` — no `setIcon`, which would make this the plugin's first icon
 * call and pull in the harness icon renderer CLAUDE.md lists as deliberately absent.
 *
 * No props: it reads THIS Plan Editor's own store from its own Pinia instance, so two open
 * editors indicate independently.
 *
 * SDD companion §2.5: "Saved · refresh needed" is DERIVED here, beside `state`, rather than a
 * fifth `SaveState` member — the write really did land, so `saved` stays the truth, and
 * `ProjectStore.stale` is read as a qualifier on top of it. `SaveStateStore` gains no view of
 * hydration for this: it has no ticket to compare against a refresh, and giving it one would
 * make this indicator a second reader of `ProjectStore`'s own tickets.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { SAVE_STATE_KEYS } from './save-state';
import { useSaveStateStore } from './save-state-store';
import { useProjectStore } from '../../stores/ProjectStore';

const { state } = storeToRefs(useSaveStateStore());
const { stale } = storeToRefs(useProjectStore());

/** Derived, not stored: the write landed, so `saved` is still the truth; `stale` is the qualifier. */
const shown = computed(() => (state.value === 'saved' && stale.value ? 'saved-refresh-needed' : state.value));
const label = computed(() =>
	tr(shown.value === 'saved-refresh-needed' ? 'save-state.saved-refresh-needed' : SAVE_STATE_KEYS[shown.value]),
);
</script>

<template>
	<span
		class="rp-save-state-label"
		:class="`rp-save-state-${shown}`"
	><span
		class="rp-save-state-mark"
		aria-hidden="true"
	/>{{ label }}</span>
</template>
