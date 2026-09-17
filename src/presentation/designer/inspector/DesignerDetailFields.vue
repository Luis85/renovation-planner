<script setup lang="ts">
/**
 * One selected graphic's own two fields: its name and its line style.
 *
 * **Its own component because the selection inspector's template breached fallow's
 * cognitive-complexity threshold**, and this is the part of it with a loop wrapped around a pair of
 * labelled controls — the branchiest thing in a template that is otherwise a list of rows. Moving it
 * is the same answer the preset gallery, the Arrange panel's action row and the designer root's
 * entry paths each got when the same gate fired on them.
 *
 * It owns nothing. The name is a stable semantic key shown through `semanticLabel`, the line is one
 * of two values, and both changes go back to the inspector, which dispatches them through the leaf's
 * one write chain. A component that held either would be a second answer to what this graphic is.
 *
 * Drawn per member of the selected SET, so a multi-part selection gets one of these per graphic —
 * which is why the id travels with each change rather than being implied by a focused part.
 */
import { tr } from '../../i18n/strings';
import { semanticLabel } from '../parts/partNames';

defineProps<{
	details: readonly { readonly id: string; readonly name: string; readonly line: string }[];
	onName: (id: string, event: Event) => void;
	onLine: (id: string, event: Event) => void;
}>();
</script>

<template>
	<template
		v-for="item in details"
		:key="item.id"
	>
		<label class="rp-designer-field">
			{{ tr('designer.selection.name') }}
			<input
				type="text"
				name="detail-name"
				:value="semanticLabel(item.name)"
				@change="onName(item.id, $event)"
			>
		</label>
		<label class="rp-designer-field">
			{{ tr('designer.selection.line') }}
			<select
				name="detail-line"
				:value="item.line"
				@change="onLine(item.id, $event)"
			>
				<option value="solid">
					{{ tr('designer.selection.line.solid') }}
				</option>
				<option value="dashed">
					{{ tr('designer.selection.line.dashed') }}
				</option>
			</select>
		</label>
	</template>
</template>
