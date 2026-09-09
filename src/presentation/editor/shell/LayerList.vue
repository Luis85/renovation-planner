<script setup lang="ts">
import { useId } from 'vue';
import LayerRow from './LayerRow.vue';
import type { PlanDto } from '../../read-models/PlanDto';
import type { LayerEntry } from '../layers/layerCatalogue';
defineProps<{ entries: readonly LayerEntry[]; plan?: PlanDto | null }>();
const emit = defineEmits<{ activateTool: [toolId: 'calibrate'] }>();

/**
 * A TOTAL record over `LayerEntry['id']`, every id called unconditionally — never derived
 * from `entries` at call time, because `entries` starts as an empty array before the plan
 * has hydrated and grows to two once it has: a length-dependent `useId()` call would answer
 * a different count on the render that adds the rows it needs one for. Three ids per entry
 * rather than two: the checkbox and ITS reason are two elements the checkbox's own
 * `aria-describedby` can target, and `actionReason` is a THIRD, reserved for the one case
 * `LayerRow.actionReasonId` actually needs a SEPARATE span for — design spec §2.9 gave Set scale
 * a reason that CAN differ from the row's own (`editor.paused.reason` against "no
 * background"), and when it does, the two controls no longer share one. When it does not
 * (no background at all, where both read the same "no background" key), Set scale points at
 * the row's OWN reason id instead and this third one goes unused — reserved rather than
 * removed, because the id has to exist unconditionally for the reason above, whether or not
 * this particular render ends up pointing anything at it.
 */
const ids: Record<LayerEntry['id'], { readonly checkbox: string; readonly reason: string; readonly actionReason: string }> = {
	reference: { checkbox: useId(), reason: useId(), actionReason: useId() },
	rooms: { checkbox: useId(), reason: useId(), actionReason: useId() },
};

</script>
<template>
	<ul class="rp-layer-list">
		<LayerRow
			v-for="entry in entries"
			:key="entry.id"
			:entry="entry"
			:ids="ids[entry.id]"
			:plan="plan"
			@activate-tool="emit('activateTool', $event)"
		/>
	</ul>
</template>
