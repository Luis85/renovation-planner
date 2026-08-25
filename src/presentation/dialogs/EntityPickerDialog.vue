<script setup lang="ts">
/**
 * Supplies the Reassign target `DeleteReferenceDialog` deliberately does not carry.
 *
 * It renders the candidates it is handed, in the order given, and knows nothing about
 * Zones, Assets or projects. Eligibility is a DOMAIN question answered by the caller's
 * query; a picker that filtered or sorted would be a second place those rules live, and
 * the test for that is the ordering assertion in `dialogKinds.test.ts`.
 *
 * The empty case renders a sentence rather than an empty list. A caller is expected not to
 * open a picker with nothing in it — but a dialog whose only affordance is Cancel, and
 * which says nothing about why, is worse than one that explains itself.
 */
import { tr } from '../i18n/strings';
import type { EntityPickerDescriptor, EntityPickerDialogResult } from './dialog-store';

defineProps<{ descriptor: EntityPickerDescriptor; titleId: string }>();
defineEmits<{ resolve: [result: EntityPickerDialogResult] }>();
</script>

<template>
	<h2
		:id="titleId"
		class="rp-dialog-title"
	>
		{{ descriptor.title }}
	</h2>
	<ul
		v-if="descriptor.candidates.length > 0"
		class="rp-dialog-candidates"
	>
		<li
			v-for="candidate in descriptor.candidates"
			:key="candidate.id"
		>
			<button
				type="button"
				class="rp-dialog-candidate"
				@click="$emit('resolve', { id: candidate.id })"
			>
				{{ candidate.label }}
			</button>
		</li>
	</ul>
	<p
		v-else
		class="rp-dialog-message"
	>
		{{ tr('dialog.entity-picker.empty') }}
	</p>
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
