<script setup lang="ts">
/**
 * The submit row every dialog form ends with, which was written out twice byte-for-byte.
 *
 * `NewProjectForm` and `NewPlanForm` each closed with the same `.rp-dialog-actions` wrapper and
 * the same `.rp-dialog-button`, and `npm run analyze` reported the pair as a clone group once
 * `main` drove duplication to zero. A third creation form would have made it three.
 *
 * **It is the dialog's ONE action row (AD18 UI critique, Task 4).** Mounted inside `FormDialog`, it
 * draws the dialog's Cancel before the submit — Obsidian's order — and `claim`s the row so
 * `FormDialog` stops drawing its own Cancel under it (`formFooter.ts`). The submit stays a real
 * `type="submit"` inside the form, so Enter in a field still submits, and it carries `mod-cta`,
 * Obsidian's primary-action class. The row is pinned at the foot of the scrolling dialog body
 * (`.rp-dialog-footer`), so a long form scrolls above it. Mounted with no `FormDialog` around it,
 * there is no dialog to cancel and it draws the submit alone.
 *
 * **`aria-disabled` rather than `disabled`, and that is a FOCUS rule rather than a styling
 * preference.** While a write is in flight no control may be `disabled`: Chromium moves focus
 * to `<body>` when the element holding it is disabled, and `<body>` is outside `.rp-dialog`,
 * where `DialogHost` binds its `keydown` listener — so disabling the focused control would take
 * `Escape` and the whole Tab trap out for exactly the window `busy` exists to make `Escape`
 * refuse DELIBERATELY. The button stays focusable and is made INOPERATIVE instead.
 * `useDialogFormBusy` is the other half of the same invariant, on the input side. The Cancel here
 * follows the same rule, reading the dialog's `busy` exactly as `FormDialog`'s own Cancel does.
 *
 * `submitting` is what marks the submit inoperative; the preset form passes its build refusal
 * through it. The label defaults to `dialog.form.submit`, the string every creation form's submit
 * says; a form whose submit says something else (the preset form's Apply) passes its own.
 */
import { inject } from 'vue';
import { tr } from '../i18n/strings';
import { FORM_FOOTER } from './formFooter';

defineProps<{ submitting: boolean; label?: string }>();

const footer = inject(FORM_FOOTER, null);
footer?.claim();
</script>

<template>
	<div class="rp-dialog-actions rp-dialog-footer">
		<button
			v-if="footer !== null"
			type="button"
			class="rp-dialog-button"
			data-rp-action="cancel"
			:aria-disabled="footer.busy()"
			@click="footer.cancel()"
		>
			{{ tr('dialog.cancel') }}
		</button>
		<button
			type="submit"
			class="rp-dialog-button mod-cta"
			:aria-disabled="submitting"
		>
			{{ label ?? tr('dialog.form.submit') }}
		</button>
	</div>
</template>
