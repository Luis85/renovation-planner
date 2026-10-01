<script setup lang="ts">
/**
 * The compact row's PRESENTATION (AD18-R16 Task 5's follow-up): the short label, the control
 * column and the unit suffix, with no opinion about how the input inside it commits. Five
 * callers draw through it — `DesignerFieldRow` (which owns the immediate-`@change` shape and
 * now composes this rather than drawing its own copy of the row) for the selection inspector
 * and the set-transform fields, and three callers whose commit behaviour is NOT that shape: the
 * clearance helper's four setbacks, the repeat form's Copies and Spacing, and the asset's own
 * Height (through `FieldError`). `DesignerFieldRow.vue`'s own docblock — and this task's report
 * — say why swapping the WHOLE component in is not mechanical for those three: a raw-text draft
 * committed once by a button (C03), or a draft/commit/cancel/pending contract `FieldError`
 * already owns. Neither fits `DesignerFieldRow`'s props, so only the row is shared, through a
 * slot the caller fills with its own `<input>`, keeping its own `v-model`/draft wiring, its own
 * `name`, and its own `aria-label`
 * (a one-line `:aria-label="tr(fullLabelKey)"` on that input — the same WCAG 2.5.3 pairing
 * `DesignerFieldRow` draws, deliberately left to the caller rather than threaded back through a
 * scoped slot: this component never needs to know the full sentence, only the short one, and
 * "one more attribute on an input the caller already owns" is cheaper than a second prop this
 * shell would otherwise do nothing with).
 *
 * The input is nested inside this component's own `<label>`, exactly as `DesignerFieldRow`'s
 * is, so clicking the short label still focuses the field through the ordinary implicit
 * association — no `id`/`for` pairing is needed here even where the caller already carries one
 * for `FieldError`'s sake.
 *
 * Error text is NOT drawn here. `FieldError`'s own `<p class="rp-field-error__message">` sits
 * beside this component's slot content inside `FieldError`'s wrapper, never inside it, so an
 * error still renders under the row exactly as it did before this component existed; the
 * clearance helper's refusal is its own alert below the whole field list, also unmoved.
 */
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';

defineProps<{
	/** The visible label, short (`Height`, `Front`, `Spacing`) — the row's left half. */
	short: StringKey;
	/** The suffix drawn inside the field's trailing edge, `aria-hidden`; absent for a bare count. */
	unit?: 'mm' | '°';
}>();
</script>

<template>
	<label class="rp-designer-field-row">
		<span class="rp-designer-field-row__label">{{ tr(short) }}</span>
		<span class="rp-designer-field-row__control">
			<slot />
			<span
				v-if="unit !== undefined"
				class="rp-designer-field-row__unit"
				aria-hidden="true"
			>{{ unit }}</span>
		</span>
	</label>
</template>
