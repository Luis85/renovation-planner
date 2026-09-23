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
 * name, and `wrapper.text()` equals exactly the label in every state but one: a `saved` this
 * session has seen a write land in, which is the relative time below. Everything it draws is CSS in
 * `styles/editor-status.css` — no `setIcon`, which would make this the plugin's first icon
 * call and pull in the harness icon renderer CLAUDE.md lists as deliberately absent.
 *
 * It reads THIS leaf's own stores from its own Pinia instance, so two open editors indicate
 * independently.
 *
 * SDD companion §2.5: "Saved · refresh needed" is DERIVED here, beside `state`, rather than a
 * fifth `SaveState` member — the write really did land, so `saved` stays the truth, and
 * staleness is read as a qualifier on top of it. `SaveStateStore` gains no view of hydration
 * for this: it has no ticket to compare against a refresh, and giving it one would make this
 * indicator a second reader of `ProjectStore`'s own tickets.
 *
 * **`stale` is the ONE prop, and it exists because the two stores above are a PLAN EDITOR's
 * stores.** `grep -rn "useProjectStore\|usePlanningReadState" src/presentation/designer/` prints
 * nothing, and the Asset designer mounts its own Pinia (`AssetDesignerView`'s
 * `app.use(createPinia())`), so both sat at their defaults on that surface and the qualifier was
 * UNREACHABLE there — a header reading `Saved` a few pixels above the designer's own
 * refresh-failed strip, which is what contract C08 forbids by name. A caller that owns a
 * staleness fact of its own hands it in; a caller that does not passes nothing and the two
 * stores decide, exactly as before. The prop was preferred over teaching this component a
 * second store because the designer's `assetDesignStore` has no business being constructed
 * inside a Plan Editor's Pinia.
 *
 * The LABEL is reused rather than minted per surface, checked rather than assumed: `Saved ·
 * refresh needed` / `Gespeichert · Aktualisierung nötig` names no subject, so it reads correctly
 * over an asset. The sentence that DOES name one — `editor.refresh-failed` against
 * `designer.refresh-failed` — stays per-surface, which is why each surface keeps its own strip.
 *
 * **The relative save time (AD18-R19), on BOTH surfaces** — `Saved just now`, `Saved N min ago`,
 * then `Saved at HH:MM` in the host language's own clock format (`Intl` over `currentLanguage()`,
 * the way `ProjectRow.vue` dates a row) — counted from `savedAt` in the save-state store. With no
 * write this session it stays plain `Saved`: an earlier save's time is not known. The derived
 * qualifier outranks it (C08), since a stale canvas must never read as freshly saved.
 *
 * **The phrase is `aria-hidden`, and a visually-hidden copy of the plain word stands in for it.**
 * `StatusBar.vue` mounts this inside a `role="status"` region, so any text change in here is
 * announced, and a minute tick is not an event. So what a screen reader has is the state word
 * alone — `saving` to `saved` still announces `Saved`, and the tick changes nothing it can
 * hear. The designer's header is not live, and gets the same markup anyway: one indicator, one
 * spelling. The cost is that a screen reader never hears the time on either surface.
 */
import { computed, onBeforeUnmount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { currentLanguage, tr } from '../../i18n/strings';
import { SAVE_STATE_KEYS } from './save-state';
import { useSaveStateStore } from './save-state-store';
import { useProjectStore } from '../../stores/ProjectStore';
import { usePlanningReadState } from '../planning/planningReadState';

const props = defineProps<{
	/**
	 * A staleness this component cannot see from the stores below. Absent means "the stores
	 * decide", which is what the Plan Editor's `StatusBar.vue` passes — and "absent" reaches
	 * `shown` as `false` rather than `undefined`, since a type-declared optional boolean compiles
	 * to `{ type: Boolean, required: false }` and Vue casts an absent one with no default to
	 * `false`. `DesignerHeader.vue` is the one that hands a value in. Those are the two mounts in `src/` — and do not re-measure
	 * with `grep -rn "<SaveStateIndicator" src/`, which answers THREE because this sentence
	 * names the tag it is talking about.
	 */
	stale?: boolean;
}>();

const { state, savedAt } = storeToRefs(useSaveStateStore());
const { stale: projectStale } = storeToRefs(useProjectStore());
const planning = usePlanningReadState();

/** Derived, not stored: the write landed, so `saved` is still the truth; staleness is the qualifier. */
const shown = computed(() =>
	state.value === 'saved' && (projectStale.value || props.stale === true || planning.failed) ? 'saved-refresh-needed' : state.value,
);
const label = computed(() =>
	tr(shown.value === 'saved-refresh-needed' ? 'save-state.saved-refresh-needed' : SAVE_STATE_KEYS[shown.value]),
);

const MINUTE = 60_000;
/** The minute tick the relative phrase moves on, cleared with the component so no leaf leaks it. */
const now = ref(Date.now());
const tick = window.setInterval(() => {
	now.value = Date.now();
}, MINUTE);
onBeforeUnmount(() => window.clearInterval(tick));

/**
 * `null` means "say the label alone". `now` may lag a fresh stamp by up to a minute, so a
 * negative elapsed time is a save that has only just landed.
 */
const relative = computed(() => {
	if (shown.value !== 'saved' || savedAt.value === null) return null;
	const minutes = Math.floor((now.value - savedAt.value) / MINUTE);
	if (minutes < 1) return tr('save-state.saved-just-now');
	if (minutes < 60) return tr('save-state.saved-minutes-ago', { minutes: String(minutes) });
	return tr('save-state.saved-at', {
		time: new Intl.DateTimeFormat(currentLanguage(), { timeStyle: 'short' }).format(savedAt.value),
	});
});
</script>

<template>
	<span
		class="rp-save-state-label"
		:class="`rp-save-state-${shown}`"
	><span
		class="rp-save-state-mark"
		aria-hidden="true"
	/><template v-if="relative === null">{{ label }}</template><template v-else><span class="rp-visually-hidden">{{ label }}</span><span aria-hidden="true">{{ relative }}</span></template></span>
</template>
