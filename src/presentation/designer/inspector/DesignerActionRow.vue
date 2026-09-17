<script setup lang="ts">
/**
 * One row of composition actions, drawn only when it has any.
 *
 * **Its own component because the Arrange panel drew this shape three times** — group, align,
 * distribute — as three `v-if`-guarded `v-for`s over the same button, which is what put that
 * template over fallow's cognitive-complexity threshold. Three copies of a row is also three places
 * for the row to drift; this is one, and the panel above it now reads as the list of rows it is.
 *
 * The empty check lives HERE rather than at each caller, which is the whole saving: a row with no
 * actions draws nothing at all rather than an empty `<div>` with a gap around it.
 *
 * `disabled` is always false and is passed explicitly rather than defaulted: a composition action
 * this selection cannot take is not DRAWN — the panel decides which actions exist — so a disabled
 * one here would be the live control that does nothing this repository refuses.
 */
import type { StringKey } from '../../i18n/locales/en';
import DesignerActionButton from './DesignerActionButton.vue';

defineProps<{
	actions: readonly { readonly name: string; readonly label: StringKey; readonly run: () => void }[];
}>();
</script>

<template>
	<div
		v-if="actions.length > 0"
		class="rp-designer-selection-actions"
	>
		<DesignerActionButton
			v-for="action in actions"
			:key="action.name"
			:name="action.name"
			:label="action.label"
			:disabled="false"
			:on-run="action.run"
		/>
	</div>
</template>
