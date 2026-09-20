<script setup lang="ts">
/**
 * One button of a designer tool, in the toolbar or in the `Add` rail: a native icon, the same
 * label beside it, and that label again as the button's `aria-label` (AD18 item 3).
 *
 * **WHETHER THE VISIBLE LABEL IS DRAWN IS THE CONTAINER'S DECISION AND NOT THIS COMPONENT'S.**
 * `styles/designer-toolbar.css` hides `.rp-designer-tool-label` below 80rem;
 * `styles/designer-add.css` hides the rail's at EVERY width. This file knows about neither, takes
 * no `showLabel` prop and must not grow one — that would be a second authority on a question a
 * stylesheet already answers, and this component carries a recorded correction about exactly that
 * shape (`pressed`/`disabled` as props, below).
 *
 * **So "both spellings are LIVE, which is why neither is dead markup" — what this docblock said
 * before AD18 item 5 — stopped being true of every call site.** In the toolbar at 80rem and wider
 * both are drawn and they are the SAME string, which is what WCAG 2.5.3 asks of a visible label
 * and an accessible name that could otherwise disagree. Everywhere else the span is hidden and
 * `aria-label` is the whole accessible name — and in the rail that is every width, so there the
 * span is never seen. It is kept rather than removed, deliberately: `display: none` takes it out
 * of the accessibility tree too, so it costs nothing in either tree, and the rail's treatment is
 * one CSS rule that one line could reverse, where deleting the span would make that a component
 * change. Neither state is checkable here in any case — jsdom applies no container query and
 * computes no width, so what a test reads is the attribute, and what `designerIconToolbar.test.ts`
 * reads of a rule is what it DECLARES.
 *
 * ONE component rather than the markup written out per call site. `grep -rn "DesignerToolButton"
 * src/presentation/designer/` prints NINE lines in this edit — one in this file, which is this
 * sentence; three in `DesignerAddPanel.vue` (a prose mention, the import, the element); five in
 * `DesignerToolbar.vue` (a prose mention, the import, three elements). Two callers, and the
 * prose lines are counted in rather than left out of the sentence describing the grep.
 *
 * **The element count and the loop count are different numbers and the older version of this
 * paragraph conflated them.** There are FOUR elements in TWO `v-for` loops plus two fixed
 * buttons: the toolbar's loop over `MODES`, its `Undo` and `Redo` written out inside
 * `.rp-designer-history`, and the rail's loop over its own shape rows. Before AD18 item 5 the
 * toolbar drew three runs of its own, because the shape group was cut out of `MODES` by index;
 * item 5 lifted that group into `DesignerAddPanel.vue` and the remaining slices collapsed back
 * into the single loop above.
 *
 * **It takes the label and the glyph and NOTHING about state**, which is a correction rather
 * than a preference: `pressed` and `disabled` were props first, and Vue casts an ABSENT prop
 * declared `boolean` to `false` — so Undo and Redo rendered `aria-pressed="false"`, announcing
 * themselves as toggles that happen to be off. Measured, not reasoned: the case that now reads
 * `toBeUndefined()` failed with `expected 'false' to be undefined`. The caller passes
 * `aria-pressed`, `disabled`, the active class and `@click` as ordinary attributes, which fall
 * through to the one root element and merge with what is declared here — so an attribute the
 * caller does not pass is simply absent, and this file never has to model the difference.
 *
 * **No `title`.** The toolbar's own docblock records why it never carried one; the icon-only
 * state does not change that, because Obsidian draws its own tooltip from `aria-label` — host
 * behaviour, which nothing in this repository can check, so the sentence claims the attribute
 * and not the tooltip.
 */
import type { IconName } from 'obsidian';
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';
import HostIcon from '../components/HostIcon.vue';

defineProps<{ label: StringKey; icon: IconName }>();
</script>

<template>
	<button
		type="button"
		class="rp-designer-tool-button"
		:aria-label="tr(label)"
	>
		<HostIcon :name="icon" /><span class="rp-designer-tool-label">{{ tr(label) }}</span>
	</button>
</template>
