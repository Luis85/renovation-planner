<script setup lang="ts">
/**
 * Task B8's kind — a width and a depth, or `null` for cancelled. No `component` field, no
 * `useFormCommit`, no submit sequence: this dialog answers no command at all, which is what
 * `dialog-store.ts`'s own header on `AssetDimensionsDescriptor` states and what keeps a query,
 * a command and a repository out of `presentation/dialogs/` (design slice 15, Definition of
 * Done 9). The CALLER dispatches `SetAssetFootprintFromDimensions` once this resolves.
 *
 * Validation is the one thing this dialog owns rather than defers, and it is the same shape
 * `KnownDistanceForm` already takes for its own single numeric field: `aria-disabled` on the
 * submit control rather than a live command refusal, because nothing behind either input can
 * refuse anything — a positive finite number is the whole of what a rectangle's side needs to
 * be. `Number.isFinite` before `> 0` for the same reason `KnownDistanceForm`'s does: `NaN > 0`
 * is `false`, but stating the finiteness check keeps the guard readable as two separate facts
 * about the number rather than one that happens to reject both by accident.
 */
import { computed, ref } from 'vue';
import { tr } from '../i18n/strings';
import type { AssetDimensionsDescriptor, AssetDimensionsDialogResult } from './dialog-store';

const props = defineProps<{ descriptor: AssetDimensionsDescriptor; titleId: string }>();
const emit = defineEmits<{ resolve: [result: AssetDimensionsDialogResult] }>();

/**
 * `string | number`, exactly as `KnownDistanceForm.typed` is and for the same reason: `v-model`
 * on `type="number"` casts to a `number` for whatever the browser accepts and leaves a
 * `string` — usually `''` — for whatever it sanitized away, so both have to be normalised
 * through `String(...)` before parsing.
 */
const width = ref<string | number>(props.descriptor.initial?.width ?? '');
const depth = ref<string | number>(props.descriptor.initial?.depth ?? '');

function parsed(raw: string | number): number | null {
	const text = String(raw).trim();
	const value = Number(text);
	return text !== '' && Number.isFinite(value) && value > 0 ? value : null;
}

const values = computed<{ readonly width: number; readonly depth: number } | null>(() => {
	const parsedWidth = parsed(width.value);
	const parsedDepth = parsed(depth.value);
	return parsedWidth !== null && parsedDepth !== null ? { width: parsedWidth, depth: parsedDepth } : null;
});

function onSubmit(): void {
	const result = values.value;
	if (result === null) return;
	emit('resolve', result);
}
</script>

<template>
	<h2
		:id="titleId"
		class="rp-dialog-title"
	>
		{{ descriptor.title }}
	</h2>
	<form
		class="rp-dialog-form"
		@submit.prevent="onSubmit"
	>
		<label class="rp-dialog-field">
			{{ tr('designer.dimensions.width') }}
			<input
				v-model="width"
				type="number"
				name="width"
				min="0"
				step="any"
				inputmode="decimal"
			>
		</label>
		<label class="rp-dialog-field">
			{{ tr('designer.dimensions.depth') }}
			<input
				v-model="depth"
				type="number"
				name="depth"
				min="0"
				step="any"
				inputmode="decimal"
			>
		</label>
		<div class="rp-dialog-actions">
			<button
				type="button"
				class="rp-dialog-button"
				data-rp-action="cancel"
				@click="$emit('resolve', null)"
			>
				{{ tr('dialog.cancel') }}
			</button>
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="values === null"
			>
				{{ tr('dialog.form.submit') }}
			</button>
		</div>
	</form>
</template>
