<script setup lang="ts">
/**
 * One labelled checkbox per `LayerEntry`, plus — on the one entry that carries one — a Set
 * scale action button. `entries` is a PROP (the design spec's own two-entry catalogue), not
 * a query this component makes itself, so an overlay elsewhere in the shell can hand it the
 * same list without re-deriving it.
 *
 * A real checkbox with a real `<label for>`, not a styled `<div>` with a click handler — §85
 * wants keyboard-accessible controls and semantic labels, and the platform control already is
 * both.
 */
import { useId } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import type { LayerEntry } from '../layers/layerCatalogue';

defineProps<{ entries: readonly LayerEntry[] }>();
const emit = defineEmits<{ activateTool: [toolId: 'calibrate'] }>();

const workspace = useWorkspaceStore();
const { layerVisibility } = storeToRefs(workspace);

/**
 * A TOTAL record over `LayerEntry['id']`, both ids called unconditionally — never derived
 * from `entries` at call time, because `entries` starts as an empty array before the plan
 * has hydrated and grows to two once it has: a length-dependent `useId()` call would answer
 * a different count on the render that adds the rows it needs one for. Two calls per id
 * rather than one, because the checkbox and its reason are two elements that can each be
 * the target of an `aria-describedby` — the Set scale button points at the same reason id
 * as the checkbox, and the two need to agree on what "the same reason" IS.
 */
const ids: Record<LayerEntry['id'], { readonly checkbox: string; readonly reason: string }> = {
	reference: { checkbox: useId(), reason: useId() },
	rooms: { checkbox: useId(), reason: useId() },
};
</script>

<template>
	<ul class="rp-layer-list">
		<li
			v-for="entry in entries"
			:key="entry.id"
			class="rp-layer-list__row"
		>
			<input
				:id="ids[entry.id].checkbox"
				type="checkbox"
				:checked="layerVisibility[entry.konvaLayer]"
				:disabled="entry.state === 'supported-empty'"
				:aria-describedby="entry.reasonKey !== null ? ids[entry.id].reason : undefined"
				@change="workspace.toggleLayer(entry.konvaLayer)"
			>
			<label :for="ids[entry.id].checkbox">{{ tr(entry.labelKey) }}</label>
			<span
				v-if="entry.reasonKey !== null"
				:id="ids[entry.id].reason"
				class="rp-layer-list__reason"
			>{{ tr(entry.reasonKey) }}</span>
			<button
				v-if="entry.action !== null"
				type="button"
				class="rp-layer-list__action"
				data-rp-action="set-scale"
				:disabled="!entry.action.enabled"
				:aria-describedby="entry.reasonKey !== null ? ids[entry.id].reason : undefined"
				@click="emit('activateTool', entry.action.toolId)"
			>
				{{ tr(entry.action.labelKey) }}
			</button>
		</li>
	</ul>
</template>
