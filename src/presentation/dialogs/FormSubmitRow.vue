<script setup lang="ts">
/**
 * The submit row every dialog form ends with, which was written out twice byte-for-byte.
 *
 * `NewProjectForm` and `NewPlanForm` each closed with the same `.rp-dialog-actions` wrapper and
 * the same `.rp-dialog-button`, and `npm run analyze` reported the pair as a clone group once
 * `main` drove duplication to zero. A third creation form would have made it three.
 *
 * **`aria-disabled` rather than `disabled`, and that is a FOCUS rule rather than a styling
 * preference.** While a write is in flight no control may be `disabled`: Chromium moves focus
 * to `<body>` when the element holding it is disabled, and `<body>` is outside `.rp-dialog`,
 * where `DialogHost` binds its `keydown` listener — so disabling the focused control would take
 * `Escape` and the whole Tab trap out for exactly the window `busy` exists to make `Escape`
 * refuse DELIBERATELY. The button stays focusable and is made INOPERATIVE instead.
 * `useDialogFormBusy` is the other half of the same invariant, on the input side.
 *
 * The label is resolved HERE rather than passed in, because it is the one string every form's
 * submit says and `dialog.form.submit` is already the shared key both were resolving.
 */
import { tr } from '../i18n/strings';

defineProps<{ submitting: boolean }>();
</script>

<template>
	<div class="rp-dialog-actions">
		<button
			type="submit"
			class="rp-dialog-button"
			:aria-disabled="submitting"
		>
			{{ tr('dialog.form.submit') }}
		</button>
	</div>
</template>
