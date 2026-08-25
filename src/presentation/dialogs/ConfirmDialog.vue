<script setup lang="ts">
/**
 * The binary question, for an action whose whole story is "are you sure" (design slice
 * 15). Which actions get one is decided by the slice that OWNS the action, against the
 * spec's two-part test — irreversible/destructive, or reference-bearing — not here.
 *
 * Props in, one event out, and no store: `DialogHost` is the single caller of
 * `dialogStore.resolve`, so this component cannot settle a Promise twice even in
 * principle. No `<style>` block, ever — `vue/no-restricted-block` fails one and the CSS
 * lives in `styles/dialogs.css`.
 */
import { tr } from '../i18n/strings';
import type { ConfirmDescriptor, ConfirmDialogResult } from './dialog-store';

defineProps<{ descriptor: ConfirmDescriptor; titleId?: string }>();
defineEmits<{ resolve: [result: ConfirmDialogResult] }>();
</script>

<template>
	<h2
		:id="titleId"
		class="rp-dialog-title"
	>
		{{ descriptor.title }}
	</h2>
	<p class="rp-dialog-message">
		{{ descriptor.message }}
	</p>
	<div class="rp-dialog-actions">
		<button
			type="button"
			class="rp-dialog-button"
			data-rp-action="cancel"
			@click="$emit('resolve', 'cancel')"
		>
			{{ descriptor.cancelLabel ?? tr('dialog.cancel') }}
		</button>
		<button
			type="button"
			class="rp-dialog-button"
			:class="{ 'rp-dialog-button-danger': descriptor.danger === true }"
			data-rp-action="confirm"
			@click="$emit('resolve', 'confirm')"
		>
			{{ descriptor.confirmLabel ?? tr('dialog.confirm') }}
		</button>
	</div>
</template>
