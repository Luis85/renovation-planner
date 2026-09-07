<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Evidence } from '../../../domain/renovation/PlanningDepth';
import type { EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import type { PlanId } from '../../../domain/plan/PlanId';
import { tr } from '../../i18n/strings';
import { evidenceThumbnailSource } from './evidenceThumbnail';
const props = defineProps<{ item: Evidence; files?: EvidenceFiles; planId: string; revision?: number }>();
const failed = ref(false);
const file = computed(() => { void props.revision; return props.files?.resolve(props.item.path + props.item.subpath, props.planId as PlanId); });
watch(file, () => { failed.value = false; });
const thumbnail = computed(() => {
	const image = !failed.value && file.value?.ok ? file.value.value.image : null;
	return image ? evidenceThumbnailSource(image, props.revision) : null;
});
</script>
<template>
	<img
		v-if="thumbnail"
		class="rp-evidence-thumbnail"
		loading="lazy"
		decoding="async"
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
