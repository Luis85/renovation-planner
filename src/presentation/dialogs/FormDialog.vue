<script setup lang="ts">
/**
 * The CONTAINER, and nothing else. This slice supplies the panel, the focus trap, the
 * `Escape` semantics and the resolution Promise; it holds no field knowledge, which is why
 * the descriptor names a component rather than describing fields.
 *
 * The form component owns its own fields, its own validation and its own submit control,
 * and lives with whoever owns the form — `presentation/editor/shell/KnownDistanceForm.vue`
 * is this slice's own caller, and slice 16's creation forms will be others. What a resolved
 * `'submit'` means is `FormDialogResult`'s own docblock to state (`dialog-store.ts`), not
 * repeated here — a caller-dispatches form and a form that owns its dispatch answer that
 * question differently, and this file once repeated the FIRST answer after slice 16 made
 * the second one real, which is exactly how the two came to disagree.
 *
 * The mounted component's `submit` payload is passed through untyped, deliberately — it is
 * typed by that component, for the same reason `FormDescriptor` carries a component and
 * not a field list.
 */
import { tr } from '../i18n/strings';
import type { FormDescriptor, FormDialogResult } from './dialog-store';

const props = defineProps<{ descriptor: FormDescriptor; titleId: string }>();
const emit = defineEmits<{ resolve: [result: FormDialogResult] }>();

function onSubmit(values: unknown): void {
	emit('resolve', { action: 'submit', values });
}

/**
 * `aria-disabled`, never `:disabled` — an invariant of the framework, not a preference.
 * `DialogHost`'s own comment states that every kind renders at least one focusable control
 * unconditionally, and `focusableWithin()` is what its Tab trap walks: a `:disabled` button
 * matches no focusable selector, so with every form control ALSO disabled while busy
 * (`NewProjectForm` and its siblings), the dialog would contain zero focusable elements —
 * Tab would walk straight out of it, and the `Escape` listener bound to `.rp-dialog` would
 * then stop receiving keys at all, defeating the very handler that refuses Escape while
 * busy. Staying focusable and announced, with the click refused here instead, is what keeps
 * the trap intact.
 */
function onCancel(): void {
	if (props.descriptor.busy?.value === true) return;
	emit('resolve', 'cancel');
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
			class="rp-dialog-button rp-dialog-cancel"
			data-rp-action="cancel"
			:aria-disabled="descriptor.busy?.value === true"
			@click="onCancel"
		>
			{{ tr('dialog.cancel') }}
		</button>
	</div>
</template>
