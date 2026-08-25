<script setup lang="ts">
/**
 * PRD §64's Cancel / Remove references / Reassign / Delete anyway decision, as its OWN
 * kind rather than a `ConfirmDialog` variant: it has four mutually exclusive outcomes and
 * the caller needs to tell all four apart.
 *
 * It does not recompute, reformat, sum, filter or reorder the rows it is handed, and it
 * invents no row when handed none — a caller with zero references decides for itself
 * whether to open this at all. The count here informs the user's decision; the COMMAND's
 * own re-check is what enforces the invariant, because a script or a migration never
 * opens a dialog.
 *
 * `data-rp-action` on each button rather than position: a test that found the third button
 * would keep passing after a reorder that swapped which one deletes.
 */
import { tr } from '../i18n/strings';
import type { DeleteReferenceDescriptor, DeleteReferenceDialogResult } from './dialog-store';

defineProps<{ descriptor: DeleteReferenceDescriptor }>();
defineEmits<{ resolve: [result: DeleteReferenceDialogResult] }>();

const ACTIONS = [
	{ action: 'cancel', label: 'dialog.cancel', danger: false },
	{ action: 'remove-references', label: 'dialog.delete-reference.remove-references', danger: false },
	{ action: 'reassign', label: 'dialog.delete-reference.reassign', danger: false },
	{ action: 'delete-anyway', label: 'dialog.delete-reference.delete-anyway', danger: true },
] as const;
</script>

<template>
	<h2 class="rp-dialog-title">
		{{ descriptor.entityLabel }}
	</h2>
	<template v-if="descriptor.references.length > 0">
		<p class="rp-dialog-message">
			{{ tr('dialog.delete-reference.referenced-by') }}
		</p>
		<ul class="rp-dialog-references">
			<li
				v-for="row in descriptor.references"
				:key="row.label"
				class="rp-dialog-reference-row"
			>
				<span>{{ row.label }}</span>
				<span>{{ row.count }}</span>
			</li>
		</ul>
	</template>
	<div class="rp-dialog-actions">
		<button
			v-for="entry in ACTIONS"
			:key="entry.action"
			type="button"
			class="rp-dialog-button"
			:class="{ 'rp-dialog-button-danger': entry.danger }"
			:data-rp-action="entry.action"
			@click="$emit('resolve', { action: entry.action })"
		>
			{{ tr(entry.label) }}
		</button>
	</div>
</template>
