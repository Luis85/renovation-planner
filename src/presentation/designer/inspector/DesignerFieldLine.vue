<script setup lang="ts" generic="F extends { readonly name: string; readonly label: StringKey; readonly short: StringKey; readonly unit?: 'mm' | '°'; readonly value: number; readonly hint?: StringKey }">
/**
 * One line of the selection inspector's numbers (AD18-R17, board 01 panel 4): a single field, a PAIR
 * under one name (`Position X [..] Y [..]`, `Size Width [..] Depth [..]`), or the corner radius with its
 * slider beside it. Every field is still a `DesignerFieldRow`, so its short label, unit and commit are the
 * compact row's; this only decides what sits around them.
 *
 * **A pair is a named `role="group"`**, labelled by the visible pair name, and each input inside keeps an
 * accessible name that starts with what a sighted user reads beside it (`Position X, horizontal centre in
 * millimetres`) — WCAG 2.5.3 for a label split across two elements.
 *
 * **The slider commits on `change`, never on `input`** (C05: intermediate moves are not commands), through
 * the same `onNumber` the number field uses — so its edit, its no-op on the current radius (C03) and its
 * refusal are the field's own. Its range is `1` to the largest whole millimetre `setCornerRadius` accepts
 * (`roundedCorner`), stepped by 1, because the stored ceiling is exclusive and a range input's is not.
 *
 * Generic over the caller's field type, so `onNumber` hands back the very object it was given — the
 * inspector's field with its `edit` — without this component knowing what an edit is.
 */
import { useId } from 'vue';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import DesignerFieldRow from './DesignerFieldRow.vue';

defineProps<{
	fields: readonly F[];
	/** The pair's visible name; absent for a line of one field. */
	pair?: StringKey;
	/** The corner radius's slider: the field it moves, its accessible name, and its largest value. */
	slider?: { readonly field: F; readonly label: StringKey; readonly largest: number };
	onNumber: (field: F, event: Event) => void;
}>();

const pairId = useId();
</script>

<template>
	<div
		class="rp-designer-field-line"
		:class="{ 'rp-designer-field-pair': pair !== undefined, 'rp-designer-radius-field': slider !== undefined }"
		:role="pair === undefined ? undefined : 'group'"
		:aria-labelledby="pair === undefined ? undefined : pairId"
	>
		<span
			v-if="pair !== undefined"
			:id="pairId"
			class="rp-designer-field-pair__label"
		>{{ tr(pair) }}</span>
		<DesignerFieldRow
			v-for="field in fields"
			:key="field.name"
			:name="field.name"
			:label="field.label"
			:short="field.short"
			:unit="field.unit"
			:value="field.value"
			:hint="field.hint"
			:on-change="(event: Event) => onNumber(field, event)"
		/>
		<input
			v-if="slider !== undefined"
			type="range"
			class="rp-designer-radius-field__slider"
			:name="`${slider.field.name}-slider`"
			min="1"
			:max="slider.largest"
			step="1"
			:value="Math.round(slider.field.value)"
			:aria-label="tr(slider.label)"
			@change="onNumber(slider.field, $event)"
		>
	</div>
</template>
