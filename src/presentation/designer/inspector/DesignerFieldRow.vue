<script setup lang="ts">
/**
 * One numeric field of the selection inspector (`DesignerSelectionInspector`'s width, depth,
 * centre, rotate-by, position, facing-angle and corner-radius rows, and `DesignerSetTransform`'s
 * four "by" fields), split out so its optional hint paragraph carries its own template-complexity budget
 * instead of sharing one with the `v-for` that repeats it (fallow's template complexity is
 * scored per SFC).
 *
 * **Compact row shape (AD18-R16 Task 5)**: both concept boards draw `Width [800 mm]` — a short
 * label to the LEFT and the unit inside the field's trailing edge — where this used to stack the
 * full sentence above the input. The visible text is `short`; the FULL sentence this component
 * used to show (`label`, unchanged in every caller) becomes the input's `aria-label` instead, so
 * the accessible name still names the field completely and the visible text stays a substring of
 * it (WCAG 2.5.3 label-in-name). `unit` is drawn `aria-hidden` beside the input — `mm`, `°`, or
 * left out entirely for a bare count or factor (`DesignerSetTransform`'s scale-by) — since it is
 * decoration for a sighted reader and the accessible name already says what the number means.
 *
 * The hint is drawn OUTSIDE the label, so it is the field's DESCRIPTION and never part of its
 * name, and linked by `aria-describedby`; only the facing's angle passes one. `useId` is unique
 * per leaf's app, and per instance of this component, which is what lets the same field kind
 * repeat safely.
 *
 * **Not every millimetre input in the inspector draws through this component's `@change`
 * shape.** The clearance helper's four setbacks and the repeat form's Copies and Spacing keep
 * raw text drafts committed by a button press rather than by `change` (`DesignerClearanceHelper`'s
 * and `DesignerRepeatForm`'s own docblocks state why, C03) — rounding their draft on every
 * keystroke, which this component's `Math.round(value)` would do, is the exact corruption those
 * two already refuse. The asset's own Height field (`DesignerInspector.vue`) commits through
 * `FieldError`'s draft/pending/cancel contract, which this component's plain `@change` does not
 * carry. None of the three is mechanical to converge onto THIS component — but the row itself
 * (the short label, the control column, the unit suffix) is the same picture for all four, so it
 * is `DesignerFieldRowShell`'s, and this component is now written ON TOP of that shell rather
 * than drawing its own copy of the row (AD18-R16 Task 5's follow-up).
 */
import { useId } from 'vue';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import DesignerFieldRowShell from './DesignerFieldRowShell.vue';

defineProps<{
	name: string;
	/** The visible label, short (`Width`, `Rotate by`) — the left half of the compact row. */
	short: StringKey;
	/** The field's full sentence (`Width in millimetres`), carried as the input's accessible name. */
	label: StringKey;
	/** The suffix drawn inside the field's trailing edge, `aria-hidden`; absent for a bare count or factor. */
	unit?: 'mm' | '°';
	value: number;
	hint?: StringKey;
	onChange: (event: Event) => void;
}>();

const hintId = useId();
</script>

<template>
	<DesignerFieldRowShell
		:short="short"
		:unit="unit"
	>
		<input
			type="number"
			:name="name"
			step="any"
			inputmode="decimal"
			:value="Math.round(value)"
			:aria-label="tr(label)"
			:aria-describedby="hint === undefined ? undefined : hintId"
			@change="onChange"
		>
	</DesignerFieldRowShell>
	<p
		v-if="hint !== undefined"
		:id="hintId"
		class="rp-designer-field-hint"
	>
		{{ tr(hint) }}
	</p>
</template>
