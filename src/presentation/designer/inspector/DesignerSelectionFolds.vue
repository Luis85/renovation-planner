<script setup lang="ts">
/**
 * The selected graphic's two folds (AD18-R17, board 01 panel 4): `Appearance`, holding its line style, and
 * `Order`, holding Bring forward and Send backward. Duplicate and Delete are not here — they stay out in
 * the open, drawn by the inspector below these.
 *
 * **The Arrange panel's fold, not a second one**: a bare `<details class="rp-designer-collapsible">` whose
 * `<summary>` carries a heading, so the chevron, the 24px summary hit target measured for AD18-R16 Task 6
 * and the focus ring are that one rule's. The heading is an `<h4>`, one level under the section's own
 * `<h3>`, where the Arrange panel's folds sit beside its heading and so take an `<h3>`.
 *
 * **Closed by default and leaf-local**: the open state is the element's own. No `open` is bound, so a
 * re-render after a commit leaves an opened fold open, and nothing stores it — another leaf, or this one
 * remounted for a new selection, starts closed.
 *
 * Drawn only for a GRAPHIC: `details` is empty and `order` is empty for every other kind of part, and a
 * fold with nothing in it is not drawn. The line and the order go back to the inspector, which dispatches
 * them through the leaf's one write chain; this owns nothing.
 */
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import DesignerActionButton from './DesignerActionButton.vue';

defineProps<{
	details: readonly { readonly id: string; readonly line: string }[];
	onLine: (id: string, event: Event) => void;
	order: readonly { readonly name: string; readonly label: StringKey; readonly disabled: boolean; readonly run: () => void }[];
}>();
</script>

<template>
	<details
		v-if="details.length > 0"
		class="rp-designer-collapsible"
	>
		<summary>
			<h4 class="rp-designer-panel-title rp-designer-section-title">
				{{ tr('designer.selection.fields.appearance') }}
			</h4>
		</summary>
		<label
			v-for="item in details"
			:key="item.id"
			class="rp-designer-field"
		>
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
	</details>
	<details
		v-if="order.length > 0"
		class="rp-designer-collapsible"
	>
		<summary>
			<h4 class="rp-designer-panel-title rp-designer-section-title">
				{{ tr('designer.selection.fields.order') }}
			</h4>
		</summary>
		<div class="rp-designer-selection-actions">
			<DesignerActionButton
				v-for="action in order"
				:key="action.name"
				:name="action.name"
				:label="action.label"
				:disabled="action.disabled"
				:on-run="action.run"
			/>
		</div>
	</details>
</template>
