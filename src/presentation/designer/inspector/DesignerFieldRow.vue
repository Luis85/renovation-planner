<script setup lang="ts">
/**
 * One numeric field of the selection inspector (`DesignerSelectionInspector`'s width, depth,
 * centre, rotate-by, position and facing-angle rows), split out so its optional hint paragraph
 * carries its own template-complexity budget instead of sharing one with the `v-for` that
 * repeats it (fallow's template complexity is scored per SFC).
 *
 * The hint is drawn OUTSIDE the label, so it is the field's DESCRIPTION and never part of its
 * name, and linked by `aria-describedby`; only the facing's angle passes one. `useId` is unique
 * per leaf's app, and per instance of this component, which is what lets the same field kind
 * repeat safely.
 */
import { useId } from 'vue';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';

defineProps<{
	name: string;
	label: StringKey;
	value: number;
	hint?: StringKey;
	onChange: (event: Event) => void;
}>();

const hintId = useId();
</script>

<template>
	<label class="rp-designer-field">
		{{ tr(label) }}
		<input
			type="number"
			:name="name"
			step="any"
			inputmode="decimal"
			:value="Math.round(value)"
			:aria-describedby="hint === undefined ? undefined : hintId"
			@change="onChange"
		>
	</label>
	<p
		v-if="hint !== undefined"
		:id="hintId"
		class="rp-designer-field-hint"
	>
		{{ tr(hint) }}
	</p>
</template>
