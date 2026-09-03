<script setup lang="ts">
/**
 * The Home surface's filter line (design spec §7) — an input across the pane, quiet at rest,
 * with the count at its trailing edge.
 *
 * **The count is the pane's STATE LINE, not decoration**, which is the discipline the declined
 * teletext candidate donated to this direction: `4 projects` at rest and `2 of 4` while
 * filtering, so the field has a job at every vault size. The direction's own recorded risk was
 * that two projects turn a search field into furniture; this is the answer to it.
 *
 * **It owns no state.** The query is the LIST's, handed down and emitted back — so Escape's
 * meaning, the no-match block and the row highlighting all read one value. A field holding its
 * own draft would be a second answer to what is being filtered.
 *
 * **Escape EMITS rather than clearing**, because what Escape means depends on state this
 * component cannot see: with a query it clears and focus stays; with none it hands focus to the
 * first row, and only the list knows whether there is one.
 */
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue';
import { tr } from '../i18n/strings';

const props = defineProps<{ query: string; shown: number; total: number }>();
const emit = defineEmits<{ 'update:query': [value: string]; cancel: []; keydown: [event: KeyboardEvent] }>();

/**
 * `useId` rather than a hard-coded id, and `app.config.idPrefix` is set at BOTH `createApp`
 * sites (`app-id-prefix.ts`) so two Vue apps' ids cannot collide — the mechanism design slice
 * 16's `FieldError` established.
 */
const inputId = useId();

/**
 * THE VISIBLE COUNT, recomputed the instant anything it reports moves.
 *
 * The singular is `view.project.count-one`, whose English copy SPELLS THE NUMERAL OUT (`One
 * project`); `en.ts` records the lint reason at the key. Picking by `total === 1` here is the
 * whole of this plugin's plural machinery — `t` has none.
 */
const countText = computed(() => {
	if (props.query.trim().length === 0) {
		return props.total === 1
			? tr('view.project.count-one')
			: tr('view.project.count-many', { count: String(props.total) });
	}
	return tr('view.project.filter.matches', {
		shown: String(props.shown),
		total: String(props.total),
	});
});

/**
 * What the LIVE REGION currently holds, which lags the visible count by one debounce.
 *
 * A `role="status"` re-read on every keystroke reads a five-character query five times, each
 * announcement interrupting the last — the field becomes unusable with a screen reader on
 * exactly the gesture it exists for.
 *
 * **This is the ANNOUNCEMENT only, and the visible count above must NOT be it.** Debouncing the
 * rendered count instead would make the pane's own state line wrong for the whole debounce after
 * every keystroke — and indefinitely while the user keeps typing, since each keystroke restarts
 * the timer. The rows filter immediately, so the line would read `4 projects` above two rows:
 * the count is *the state* (§3's teletext discipline, the whole reason the filter is not
 * furniture), and a state line that lags the state it reports is the one thing it must not be.
 * Only the spoken version settles.
 */
const announced = ref(countText.value);
let pending: ReturnType<typeof setTimeout> | undefined;

/**
 * How long the live region waits for the typing to stop. NOT a measured figure — it is the
 * value the design named, and nothing in this repository can measure what it should be: it is a
 * question about how fast a person types against how fast a screen reader speaks, and only a
 * vault with one running can answer it. `docs/tests/cases/` is where that gets looked at.
 */
const ANNOUNCE_DEBOUNCE_MS = 400;

/**
 * Watched on the RENDERED TEXT rather than on the three props behind it, so two keystrokes that
 * leave the count reading the same thing (`ki` and `kit` both matching two of four) arm no timer
 * and say nothing twice. The props change; the fact being announced does not.
 */
watch(countText, (text) => {
	clearTimeout(pending);
	pending = setTimeout(() => {
		announced.value = text;
	}, ANNOUNCE_DEBOUNCE_MS);
});

// A timer outliving its component is a leak with behaviour attached — this view remounts per
// navigation, so one is created and abandoned on every one of them.
onBeforeUnmount(() => {
	clearTimeout(pending);
});

/** The input element, so `ProjectList` can move focus into it (Task 8's keyboard entry). */
const input = ref<HTMLInputElement | null>(null);

/**
 * Re-emits every keydown, and — on `Escape` — ALSO fires `cancel`. §7's table has the arrows
 * work from "filter or list", so `ProjectList` needs the keys this field does not consume
 * itself; Escape's own two meanings (clear a query, or hand focus to the first row) can only be
 * resolved by the list, which is why this component still does not decide either one — it only
 * widened from "Escape alone" to "every key".
 *
 * `stopPropagation` on Escape is what the single `.esc.stop` binding this replaces already
 * carried: it keeps an unclaimed Escape from also reaching whatever Obsidian's own keymap does
 * with it while this pane has focus.
 */
function onInputKeydown(event: KeyboardEvent): void {
	if (event.key === 'Escape') {
		event.stopPropagation();
		emit('cancel');
	}
	emit('keydown', event);
}

/**
 * The smaller surface: a caller that needs to move focus into this field asks for THAT, not for
 * the element itself — which is what lets this component keep owning its own input.
 */
defineExpose({ focus: (): void => input.value?.focus() });
</script>

<template>
	<div class="rp-project-filter">
		<!-- A visually-hidden real `<label>`. A placeholder is not a label and does not
		     become one; the input carries no placeholder at all, so nothing reads as a
		     value that is not one. -->
		<label
			class="rp-project-filter__label"
			:for="inputId"
		>{{ tr('view.project.filter.label') }}</label>
		<input
			:id="inputId"
			ref="input"
			class="rp-project-filter__input"
			type="text"
			:value="query"
			@input="$emit('update:query', ($event.target as HTMLInputElement).value)"
			@keydown="onInputKeydown"
		>
		<!--
			THE VISIBLE COUNT, immediate. `aria-hidden` because the live region below carries the
			same fact for assistive technology, and two elements announcing one number is how a
			screen reader ends up saying it twice.
		-->
		<span
			class="rp-project-filter__count"
			aria-hidden="true"
		>{{ countText }}</span>
		<!--
			THE ANNOUNCEMENT, debounced and visually hidden. Separate from the line above because
			the two have different timing requirements and one element cannot have both: the
			state line must be immediate to be a state line, and the announcement must settle or
			a five-character query interrupts itself five times.
		-->
		<span
			class="rp-project-filter__announcement"
			role="status"
		>{{ announced }}</span>
	</div>
</template>
