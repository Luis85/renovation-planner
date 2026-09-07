<script setup lang="ts">
import { usePlanningContext } from './planningContext';
import type { ReviewPlanningFinding } from '../renovation/useReviewPresentation';
import { tr } from '../../i18n/strings';
import ReviewScope from '../renovation/ReviewScope.vue';
// The findings arrive from `ReviewInspector`, which derives them once and gates its all-clear on
// the same list: computed here as well, the two could disagree about whether a gap exists.
defineProps<{ findings: readonly ReviewPlanningFinding[] }>();
const planning = usePlanningContext();
</script>
<template>
	<ReviewScope planning />
	<p v-if="planning.failed.value">
		{{ tr('planning.read-failed') }}
	</p>
	<ol
		v-if="findings.length"
		class="rp-renovation-list rp-review-findings"
	>
		<li
			v-for="item in findings"
			:key="`${item.kind}:${item.id}`"
		>
			<button
				type="button"
				class="rp-review-finding"
				:data-rp-review-issue="item.id"
				:aria-label="`${item.roomLabel} · ${tr(`planning.${item.kind}`)}: ${item.sourceLabel}`"
				@click="planning.runtime.renovation.focus(item.roomId, item.mode, item.id)"
			>
				<span class="rp-review-finding__context">{{ tr(`planning.${item.kind}`) }}</span>
				<span data-rp-review-cause>{{ item.sourceLabel }}</span>
			</button>
		</li>
	</ol>
</template>
