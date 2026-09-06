<script setup lang="ts">
import { usePlanningContext } from './planningContext';
import type { PlanningFinding } from './planningProjection';
import { tr } from '../../i18n/strings';
// The findings arrive from `ReviewInspector`, which derives them once and gates its all-clear on
// the same list: computed here as well, the two could disagree about whether a gap exists.
defineProps<{ findings: PlanningFinding[] }>();
const planning = usePlanningContext();
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
