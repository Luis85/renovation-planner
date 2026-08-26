<script setup lang="ts">
/**
 * The one field the calibration gesture needs: what the two picked points measure in the
 * real world, in millimetres like every length here (ADR-009).
 *
 * Mounted inside slice 15's `FormDialog`, which supplies the panel, the focus trap, the
 * `Escape` semantics and the resolution Promise. It lives HERE and not in
 * `presentation/dialogs/` because the form belongs to its caller: that directory holds no
 * field knowledge, and `eslint.config.mjs`'s block for it is what keeps that true.
 *
 * The guard below is the SECOND of two: `CalibrateTool` already refuses a non-positive or
 * non-finite distance, because a script, an undo replay or a future caller never passes
 * through this form. What this one buys is that the user's Save press does something —
 * a submit that silently no-ops reads as a broken button.
 */
import { computed, ref } from 'vue';
import { tr } from '../../i18n/strings';

const props = defineProps<{ measured: number }>();
const emit = defineEmits<{ submit: [millimetres: number] }>();

/**
 * `string | number` because `v-model` on `type="number"` casts the DOM's string value to
 * a `number` for it whenever the browser accepts what was typed (Vue's own
 * `castToNumber`), and leaves it a `string` — usually `''` — for whatever the browser
 * sanitized away. `String(...)` below normalizes both before parsing.
 */
const typed = ref<string | number>('');

const parsed = computed(() => {
	const raw = String(typed.value).trim();
	const value = Number(raw);
	return raw !== '' && Number.isFinite(value) && value > 0 ? value : null;
});

/** Rounded for display only — the value the command receives is the raw measurement. */
const measuredLabel = computed(() => Math.round(props.measured).toString());

function onSubmit(): void {
	const value = parsed.value;
	if (value === null) return;
	emit('submit', value);
}
</script>

<template>
	<form
		class="rp-dialog-field"
		@submit.prevent="onSubmit"
	>
		<p class="rp-dialog-message">
			{{ tr('editor.calibrate.distance.measured') }} {{ measuredLabel }}
		</p>
		<label class="rp-dialog-field">
			{{ tr('editor.calibrate.distance.label') }}
			<input
				v-model="typed"
				type="number"
				min="0"
				step="any"
				inputmode="decimal"
			>
		</label>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:disabled="parsed === null"
			>
				{{ tr('dialog.form.submit') }}
			</button>
		</div>
	</form>
</template>
