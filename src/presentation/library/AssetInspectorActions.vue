<script setup lang="ts">
/**
 * The Asset library inspector's action row — §3.5's four gestures and the one line that explains
 * why `Delete` is refusing.
 *
 * **Extracted from `AssetInspector.vue` because `npm run analyze` said so**, and the finding was
 * real rather than an artefact: that template reached cognitive complexity 19 over 248 lines once
 * AD13's `Duplicate` button and its panel landed in it. The four `v-if`s in this row were the
 * densest self-contained part of it, and a row of buttons is a thing with a name — so this is a
 * factoring rather than the `<!-- fallow-ignore-next-line complexity -->` the report offers, which
 * would have recorded the number instead of reducing it.
 *
 * **Every condition arrives as a BOOLEAN, never as the inspector's `state`.** This component holds
 * no policy about when a gesture is available: `canOpenDesigner` also asks whether the design read
 * failed, `canOpenNote` admits `note-unreadable` as well as `ready`, and `canDuplicate` is false
 * while the duplicate panel is already open. Passing `state` would put a second copy of each of
 * those rules here, which is the two-answers-to-one-question shape this repository refuses.
 *
 * **`Delete` is the one control drawn while it can refuse, and that is deliberate.** Everything
 * else here is a predicate — drawn only where it works — but `Delete` stays visible and carries
 * `aria-disabled` plus `aria-describedby` pointing at the reason line, because *"this asset is in
 * use and I cannot tell you by what"* is information the user needs and a hidden button conveys
 * nothing. That is why `deleteAttributes` and the reason id are threaded from the parent rather
 * than derived here: the id has to be the same string in both places, and one `useId()` in the
 * parent is what guarantees it.
 */
defineProps<{
	canOpenDesigner: boolean;
	canOpenNote: boolean;
	canDuplicate: boolean;
	canDelete: boolean;
	/** `aria-disabled` and `aria-describedby`, computed together by the parent that owns the id. */
	deleteAttributes: Record<string, string | undefined>;
	/** The sentence under `Delete`, or `null` when it has nothing to explain. */
	deleteReason: string | null;
	deleteReasonId: string;
}>();

const emit = defineEmits<{
	openDesigner: [];
	openNote: [];
	duplicate: [];
	remove: [];
}>();

import { tr } from '../i18n/strings';
</script>

<template>
	<div class="rp-al-actions">
		<button
			v-if="canOpenDesigner"
			type="button"
			class="rp-al-action rp-al-action--designer"
			@click="emit('openDesigner')"
		>
			{{ tr('view.asset-library.open-designer') }}
		</button>
		<button
			v-if="canOpenNote"
			type="button"
			class="rp-al-action rp-al-action--note"
			@click="emit('openNote')"
		>
			{{ tr('view.asset-library.open-note') }}
		</button>
		<button
			v-if="canDuplicate"
			type="button"
			class="rp-al-action"
			data-action="duplicate-open"
			@click="emit('duplicate')"
		>
			{{ tr('view.asset-library.duplicate') }}
		</button>
		<button
			v-if="canDelete"
			type="button"
			class="rp-al-action rp-al-action--delete"
			v-bind="deleteAttributes"
			@click="emit('remove')"
		>
			{{ tr('view.asset-library.delete') }}
		</button>
	</div>
	<p
		v-if="deleteReason !== null"
		:id="deleteReasonId"
		class="rp-al-actions__reason"
	>
		{{ deleteReason }}
	</p>
</template>
