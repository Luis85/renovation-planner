<script setup lang="ts">
/**
 * One selected graphic's name field. Its line style moved into `DesignerSelectionFolds`' `Appearance`
 * fold (AD18-R17); the name stays in the open, first in the section.
 *
 * **Its own component because the selection inspector's template breached fallow's
 * cognitive-complexity threshold**, and this is the part of it with a loop wrapped around a labelled
 * control. Moving it is the same answer the preset gallery, the Arrange panel's action row and the
 * designer root's entry paths each got when the same gate fired on them.
 *
 * It owns nothing. The name is a stable semantic key shown through `semanticLabel`, and a change goes
 * back to the inspector, which dispatches it through the leaf's one write chain. A component that held
 * it would be a second answer to what this graphic is.
 *
 * Drawn per member of the selected SET, so a multi-part selection gets one of these per graphic —
 * which is why the id travels with each change rather than being implied by a focused part.
 */
import { tr } from '../../i18n/strings';
import { semanticLabel } from '../parts/partNames';

defineProps<{
	details: readonly { readonly id: string; readonly name: string }[];
	onName: (id: string, event: Event) => void;
}>();
</script>

<template>
	<label
		v-for="item in details"
		:key="item.id"
		class="rp-designer-field"
	>
		{{ tr('designer.selection.name') }}
		<input
			type="text"
			name="detail-name"
			:value="semanticLabel(item.name)"
			@change="onName(item.id, $event)"
		>
	</label>
</template>
