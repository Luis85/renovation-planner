<script setup lang="ts">
/**
 * One button of the asset designer's toolbar: a native icon, the same label beside it, and that
 * label again as the button's `aria-label` (AD18 item 3).
 *
 * **Both spellings of the label are LIVE, at different widths, which is why neither is dead
 * markup.** `styles/designer-toolbar.css` hides `.rp-designer-tool-label` below 80rem — the one
 * width AD18 measured the labelled toolbar to occupy a single row at — so below it the icon is
 * the whole of what a sighted user sees and `aria-label` is the whole accessible name; above it
 * the two are the SAME string, which is what WCAG 2.5.3 asks of a visible label and an
 * accessible name that could otherwise disagree. Neither state is checkable here: jsdom applies
 * no container query and computes no width, so what a test reads is the attribute, and what
 * `designerIconToolbar.test.ts` reads of the rule is what it DECLARES.
 *
 * ONE component rather than the markup written out per call site: `DesignerToolbar.vue` draws it
 * in three places (the tools before the shape group, the group itself, and the history pair),
 * where the markup it replaces was written out three times before this card.
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
