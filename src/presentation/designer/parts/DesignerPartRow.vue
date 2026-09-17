<script setup lang="ts">
/**
 * One row of the Parts panel (AD09).
 *
 * Split from the panel for the reason `DesignerFieldRow` and `DesignerActionButton` were split from
 * the selection inspector: fallow scores template complexity per SFC, and three row SHAPES — a group
 * header, a selectable part and the reference sheet's plain text — inside the `v-for` that repeats
 * them would carry the panel over its budget on its own.
 *
 * **A row that selects nothing is not a button.** A group header is a disclosure and nothing else
 * until AD10 gives a group an action; the reference sheet is not a part of the shape at all. Both are
 * drawn as what they are rather than as controls that would do nothing when pressed — slice 14's
 * Amendment 1, which this surface already honours at the library door and the multi-select checkbox.
 *
 * **It reads the leaf's `PartView` itself rather than being handed eight booleans.** The panel had
 * them as inline expressions on the binding, each repeating the same "is this a graphic" guard this
 * component already answers once; that is what pushed the PANEL's template over its own budget, and
 * moving the question to the component that knows the answer is the fix rather than a suppression.
 */
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
import type { PartRow } from './partRows';
import type { PartView } from './partView';
import { rowName } from './partNames';
import DesignerPartControls from './DesignerPartControls.vue';
import DesignerPartGroupRow from './DesignerPartGroupRow.vue';

const props = defineProps<{
	row: PartRow;
	/** Whether this row's part is in the selection — `aria-pressed`, the highlight, and what opens the controls. */
	selected: boolean;
	/** `0` on the roving-focus row and `-1` on the rest, so the list is ONE tab stop (WAI-ARIA's own pattern). */
	tabbable: boolean;
	view: PartView;
	/** Every graphic id in draw order, handed through to the controls. */
	graphicIds: readonly string[];
	choose: () => void;
	reorder: (id: string, direction: 'forward' | 'backward') => void;
	rename: (id: string, label: string) => void;
}>();

const name = computed(() => rowName(props.row));
/**
 * The graphic this row is, or `null` on every other kind — the ONE place that question is asked.
 * `GraphicRow.detail` is non-null by type, so nothing downstream re-asks it: the controls take an
 * `AssetDetail`, and the marks below read these two booleans.
 */
const graphic = computed(() => (props.row.kind === 'detail' ? props.row.detail : null));
const hidden = computed(() => graphic.value !== null && props.view.hidden.value.has(graphic.value.id));
const locked = computed(() => graphic.value !== null && props.view.locked.value.has(graphic.value.id));

/**
 * The attribute VALUES, resolved here rather than as ternaries on the bindings. Five of those in one
 * template is what fallow scores, and none of them is a rendering decision a reader needs to see in
 * the markup — `aria-pressed` and `aria-expanded` are both spelled as strings on purpose, since the
 * absent attribute means something different from `"false"` on each.
 */
const tabIndex = computed(() => (props.tabbable ? 0 : -1));
const pressed = computed(() => (props.selected ? 'true' : 'false'));
const nested = computed(() => ({ 'rp-designer-part--nested': props.row.kind === 'detail' && props.row.groupId !== null }));

/**
 * A group HEADER's own id, or `null` on every other kind — evaluated for every row in the list, so
 * both arms are real. `DesignerPartGroupRow` is what the true arm mounts, and it takes a `string`,
 * which is what stops the press handler re-asking a question this line has already answered.
 */
const groupId = computed(() => (props.row.kind === 'group' ? props.row.groupId : null));
</script>

<template>
	<li
		class="rp-designer-part"
		:class="nested"
		:data-kind="row.kind"
	>
		<DesignerPartGroupRow
			v-if="groupId !== null"
			:group-id="groupId"
			:name="name"
			:view="view"
			:tab-index="tabIndex"
		/>
		<span
			v-else-if="row.selection === null"
			class="rp-designer-part-static"
		>{{ name }}</span>
		<button
			v-else
			type="button"
			class="rp-designer-part-row"
			:name="row.key"
			:aria-pressed="pressed"
			:tabindex="tabIndex"
			@click="choose"
		>
			<span class="rp-designer-part-name">{{ name }}</span>
			<span
				v-if="hidden"
				class="rp-designer-part-mark"
			>{{ tr('designer.parts.hidden') }}</span>
			<span
				v-if="locked"
				class="rp-designer-part-mark"
			>{{ tr('designer.parts.locked') }}</span>
		</button>
		<DesignerPartControls
			v-if="selected && graphic !== null"
			:detail="graphic"
			:view="view"
			:graphic-ids="graphicIds"
			:reorder="reorder"
			:rename="rename"
		/>
	</li>
</template>
