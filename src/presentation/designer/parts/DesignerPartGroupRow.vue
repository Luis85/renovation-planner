<script setup lang="ts">
/**
 * A group's header row: the disclosure that folds its members away (AD09, C06).
 *
 * **It takes the group's id, not a row that might not have one**, which is why it is its own
 * component. Inside `DesignerPartRow` the press handler had to narrow on `row.kind === 'group'` to
 * reach an id `GroupRow` already declares non-null, and that narrowing's false arm was unreachable —
 * the button is drawn for group rows alone. A prop typed `string` asks nothing.
 *
 * It selects NOTHING and says so by being a disclosure rather than a pressed control: a group is
 * editing metadata until AD10 gives it an action, and a control that did nothing is the one this
 * repository refuses everywhere.
 */
import { computed } from 'vue';
import type { PartView } from './partView';

const props = defineProps<{
	groupId: string;
	name: string;
	view: PartView;
	/** `0` on the roving-focus row and `-1` on the rest, so the list stays ONE tab stop. */
	tabIndex: number;
}>();

/** Spelled as a string on purpose: an ABSENT `aria-expanded` means something different from `"false"`. */
const expanded = computed(() => (props.view.collapsed.value.has(props.groupId) ? 'false' : 'true'));
</script>

<template>
	<button
		type="button"
		class="rp-designer-part-group"
		:aria-expanded="expanded"
		:tabindex="tabIndex"
		@click="view.toggleGroup(groupId)"
	>
		{{ name }}
	</button>
</template>
