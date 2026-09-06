<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Evidence } from '../../../domain/renovation/PlanningDepth';
import type { EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import type { PlanId } from '../../../domain/plan/PlanId';
import { tr } from '../../i18n/strings';
const props = defineProps<{ item: Evidence; files?: EvidenceFiles; planId: string }>();
const failed = ref(false);
const file = computed(() => props.files?.resolve(props.item.path + props.item.subpath, props.planId as PlanId));
const thumbnail = computed(() => !failed.value && file.value?.ok ? file.value.value.image : null);
</script>
<template>
	<img
		v-if="thumbnail"
		class="rp-evidence-thumbnail"
		:src="thumbnail ?? undefined"
		:alt="item.description"
		@error="failed = true"
	>
	<p>{{ item.path }}{{ item.subpath }} · {{ tr(`planning.${item.phase}`) }}</p>
	<p
		v-if="!file?.ok"
		role="status"
	>
		{{ tr('planning.missing-file') }}
	</p>
	<p v-else-if="item.type === 'photo' && !thumbnail">
		{{ tr('planning.thumbnail-failed') }}
	</p>
</template>
