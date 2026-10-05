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
 *
 * The reference rows are keyed by INDEX, which is the spelling to be suspicious of and is
 * correct here for a reason worth stating once rather than re-deriving: `references` is a
 * readonly array inside a descriptor `DialogStore` holds in a `shallowRef` and replaces
 * WHOLESALE, so no open dialog ever re-renders this list with rows added, removed or
 * reordered — there is no reconciliation for a key to get wrong. `row.label` is not a
 * candidate either (two entity types can legitimately share one), and inventing an id the
 * caller did not supply would be this component computing something it was handed.
 */
import { computed } from 'vue';
import { tr } from '../i18n/strings';
import type { DeleteReferenceDescriptor, DeleteReferenceDialogResult } from './dialog-store';

const props = defineProps<{ descriptor: DeleteReferenceDescriptor; titleId: string }>();
defineEmits<{ resolve: [result: DeleteReferenceDialogResult] }>();

const ACTIONS = [
	{ action: 'cancel', label: 'dialog.cancel', danger: false },
	{ action: 'remove-references', label: 'dialog.delete-reference.remove-references', danger: false },
	{ action: 'reassign', label: 'dialog.delete-reference.reassign', danger: false },
	{ action: 'delete-anyway', label: 'dialog.delete-reference.delete-anyway', danger: true },
] as const;

// NOT rendered, rather than hidden or disabled: a choice the command cannot complete must be
// unreachable from the keyboard as well as invisible (owner rulings 62 and 64).
const REMOVE_ONLY: ReadonlySet<string> = new Set(['cancel', 'remove-references']);
const actions = computed(() =>
	props.descriptor.removeOnly === true ? ACTIONS.filter((entry) => REMOVE_ONLY.has(entry.action)) : ACTIONS,
);
</script>

<template>
	<h2
		:id="titleId"
		class="rp-dialog-title"
	>
		{{ descriptor.entityLabel }}
	</h2>
	<template v-if="descriptor.references.length > 0">
		<p class="rp-dialog-message">
			{{ tr('dialog.delete-reference.referenced-by') }}
		</p>
		<ul class="rp-dialog-references">
			<li
				v-for="(row, index) in descriptor.references"
				:key="index"
				class="rp-dialog-reference-row"
			>
				<span>{{ row.label }}</span>
				<span>{{ row.count }}</span>
			</li>
		</ul>
	</template>
	<p
		v-if="descriptor.removeOnly"
		class="rp-dialog-message"
		data-rp-contextual-only
	>
		{{ tr('dialog.delete-reference.contextual-only') }}
	</p>
	<div class="rp-dialog-actions">
		<button
			v-for="entry in actions"
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
