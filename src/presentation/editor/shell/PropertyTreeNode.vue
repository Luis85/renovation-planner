<script setup lang="ts">
/**
 * One plan in the Property tree (ADR-0029) and, recursively, its children. A row is a button
 * when `navigate` is given and this is not the open plan; the open plan is a `<span
 * aria-current="page">`, and with no navigation every row is text — a button that does nothing
 * is the live-control-that-does-nothing shape slice 14 refused.
 *
 * `tabindex` is the roving one `PropertyTree` manages: `0` on the open plan, `-1` elsewhere.
 * The `<li>` is the focus stop and carries the treeitem role, so IT is what a screen reader
 * announces — its name is `aria-labelledby` the row's label span (the plan name alone, never the
 * nested group's names) and its description is the localised kind; either attribute on the
 * inner row would never be read, since a description is not computed from descendants. The
 * inner button is `tabindex="-1"`; Enter/Space on the `li` is handled by the tree.
 * `data-rp-plan-id`/`data-rp-parent-id` are what the reorder increment's drag and menu key on.
 */
import { useId } from 'vue';
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
import { PLAN_KIND_ICONS, PLAN_KIND_LABELS } from '../editorIcons';
import type { PropertyTreeNode as Node } from '../../read-models/planHierarchy';

const props = defineProps<{
	readonly node: Node;
	readonly level: number;
	readonly currentId: string;
	readonly navigate?: (planId: string) => void;
}>();
/** Unique across leaves: every view sets `app.config.idPrefix` (`nextAppIdPrefix`). */
const labelId = useId();
</script>

<template>
	<li
		role="treeitem"
		:aria-level="props.level"
		:aria-expanded="props.node.children.length > 0 ? true : undefined"
		:aria-labelledby="labelId"
		:aria-description="tr(PLAN_KIND_LABELS[props.node.kind])"
		:tabindex="props.node.id === props.currentId ? 0 : -1"
		:data-rp-plan-id="props.node.id"
		:data-rp-parent-id="props.node.parentId ?? undefined"
	>
		<button
			v-if="props.navigate && props.node.id !== props.currentId"
			type="button"
			class="rp-property-tree__row"
			:data-rp-open-plan="props.node.id"
			tabindex="-1"
			@click="props.navigate(props.node.id)"
		>
			<HostIcon :name="PLAN_KIND_ICONS[props.node.kind]" /><span :id="labelId">{{ props.node.name || tr('editor.floor') }}</span>
		</button>
		<span
			v-else
			class="rp-property-tree__row"
			:aria-current="props.node.id === props.currentId ? 'page' : undefined"
		>
			<HostIcon :name="PLAN_KIND_ICONS[props.node.kind]" /><span :id="labelId">{{ props.node.name || tr('editor.floor') }}</span>
		</span>
		<ul
			v-if="props.node.children.length > 0"
			role="group"
			class="rp-property-tree__group"
		>
			<PropertyTreeNode
				v-for="child in props.node.children"
				:key="child.id"
				:node="child"
				:level="props.level + 1"
				:current-id="props.currentId"
				:navigate="props.navigate"
			/>
		</ul>
	</li>
</template>
