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
import { provide, ref } from 'vue';
import { tr } from '../i18n/strings';
import type { FormDescriptor, FormDialogResult } from './dialog-store';
import { FORM_FOOTER } from './formFooter';

const props = defineProps<{ descriptor: FormDescriptor; titleId: string }>();
const emit = defineEmits<{ resolve: [result: FormDialogResult] }>();

function onSubmit(values: unknown): void {
	emit('resolve', { action: 'submit', values });
}

function busy(): boolean {
	return props.descriptor.busy?.value === true;
}

/**
 * `aria-disabled`, never `:disabled` — an invariant of the framework, not a preference, and
 * it binds the mounted FORM as much as this button.
 *
 * `DialogHost`'s own comment states that every kind renders at least one focusable control
 * unconditionally, and `focusableWithin()` is what its Tab trap walks: a `:disabled` control
 * matches no focusable selector. Two things follow, and the second is the one that cost a
 * defect. If every control in the dialog were disabled at once the trap would hold NOTHING,
 * so Tab would walk straight out. And disabling the control that currently HOLDS focus is
 * worse than thinning the trap, because Chromium then blurs it to `<body>` — which
 * `.rp-dialog` does not contain, so the `Escape` listener bound there stops receiving keys
 * altogether, defeating the very handler that refuses Escape while busy. `NewProjectForm`
 * disabled its whole field set including its own submit button, so that happened on every
 * ordinary submit; its docblock carries the full account and the mechanisms that replaced it.
 *
 * Staying focusable and announced, with the press refused in the handler instead, is what
 * keeps both properties. `aria-disabled` needs no style of its own: Obsidian's sheet already
 * dims `button[aria-disabled="true"]` exactly as it dims `button[disabled]`.
 */
function onCancel(): void {
	if (busy()) return;
	emit('resolve', 'cancel');
}

/**
 * Whether the mounted form drew the dialog's one action row (`FormSubmitRow`, via `formFooter.ts`).
 * When it did, the Cancel below is not drawn: a second row under the form's own submit is the
 * stacked Save-over-Cancel the UI critique found. A form with its own markup and no
 * `FormSubmitRow` claims nothing and keeps this row.
 */
const claimed = ref(false);
provide(FORM_FOOTER, {
	claim: () => {
		claimed.value = true;
	},
	cancel: onCancel,
	busy,
});
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
	<div
		v-if="!claimed"
		class="rp-dialog-actions"
	>
		<button
			type="button"
			class="rp-dialog-button"
			data-rp-action="cancel"
			:aria-disabled="busy()"
			@click="onCancel"
		>
			{{ tr('dialog.cancel') }}
		</button>
	</div>
</template>
