<script setup lang="ts">
import type { Evidence } from '../../../domain/renovation/PlanningDepth';
import EvidencePreview from './EvidencePreview.vue';
import { usePlanningContext } from './planningContext';
import { tr } from '../../i18n/strings';
defineProps<{ rows: readonly Evidence[]; isSelected: (item: Evidence) => boolean }>();
const planning = usePlanningContext();
</script>
<template>
	<ol
		class="rp-evidence-gallery"
		:aria-label="tr('renovation.photos')"
	>
		<li
			v-for="(item, index) in rows"
			:key="item.id"
		>
			<button
				type="button"
				:data-rp-evidence-photo="item.id"
				:aria-current="isSelected(item) ? 'true' : undefined"
				@click="planning.runtime.renovation.focus(item.roomId, 'photos', item.id)"
			>
				<span class="rp-evidence-photo-title rp-visually-hidden">{{ index + 1 }}. {{ item.description }}</span>
				<EvidencePreview
					:item="item"
					:files="planning.files"
					:plan-id="planning.context.planId"
					:revision="planning.evidenceRevision.value"
					thumbnail-only
				/>
			</button>
		</li>
	</ol>
</template>
