<script setup lang="ts">
/**
 * The CONTAINER, and nothing else. This slice supplies the panel, the focus trap, the
 * `Escape` semantics and the resolution Promise; it holds no field knowledge, which is why
 * the descriptor names a component rather than describing fields.
 *
 * The form component owns its own fields, its own validation and its own submit control,
 * and lives with whoever owns the form — `presentation/editor/shell/KnownDistanceForm.vue`
 * is this slice's own caller, and slice 16's creation forms will be others. A resolved
 * `'submit'` means the form validated, NOT that anything was written: dispatching the
 * command is still the caller's job.
 *
 * The mounted component's `submit` payload is passed through untyped, deliberately — it is
 * typed by that component, for the same reason `FormDescriptor` carries a component and
 * not a field list.
 */
import { tr } from '../i18n/strings';
import type { FormDescriptor, FormDialogResult } from './dialog-store';

defineProps<{ descriptor: FormDescriptor; titleId?: string }>();
const emit = defineEmits<{ resolve: [result: FormDialogResult] }>();

function onSubmit(values: unknown): void {
	emit('resolve', { action: 'submit', values });
}
</script>

<template>
	<h2
		:id="titleId"
		class="rp-dialog-title"
	>
		{{ descriptor.title }}
	</h2>
	<div class="rp-dialog-body">
		<component
			:is="descriptor.component"
			v-bind="descriptor.props"
			@submit="onSubmit"
		/>
	</div>
	<div class="rp-dialog-actions">
		<button
			type="button"
			class="rp-dialog-button"
			data-rp-action="cancel"
			@click="$emit('resolve', 'cancel')"
		>
			{{ tr('dialog.cancel') }}
		</button>
	</div>
</template>
