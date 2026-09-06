<script setup lang="ts">
import { computed } from 'vue';
import { usePlanningContext } from './planningContext';
import { planningFindings, type PlanningFinding } from './planningProjection';
import { tr } from '../../i18n/strings';
const planning = usePlanningContext();
const findings = computed<PlanningFinding[]>(() => planning.baseline.value ? planningFindings(planning.baseline.value, planning.files) : []);
</script>
<template>
	<p>{{ tr('planning.review-scope') }}</p>
	<p v-if="planning.failed.value">
		{{ tr('planning.read-failed') }}
	</p>
	<ol class="rp-renovation-list">
		<li
			v-for="item in findings"
			:key="`${item.kind}:${item.id}`"
		>
			<button
				type="button"
				@click="planning.runtime.renovation.focus(item.roomId, item.mode, item.id)"
			>
				{{ tr(`planning.${item.kind}`) }} · {{ item.description }}
			</button>
		</li>
	</ol>
</template>
