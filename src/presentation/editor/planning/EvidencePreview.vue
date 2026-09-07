<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Evidence } from '../../../domain/renovation/PlanningDepth';
import type { EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import type { PlanId } from '../../../domain/plan/PlanId';
import { tr } from '../../i18n/strings';
import { evidenceThumbnailSource } from './evidenceThumbnail';
const props = defineProps<{ item: Evidence; files?: EvidenceFiles; planId: string; revision?: number; metadataOnly?: boolean; thumbnailOnly?: boolean }>();
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
		v-if="thumbnail && !metadataOnly"
		class="rp-evidence-thumbnail"
		loading="lazy"
		decoding="async"
		:src="thumbnail"
		:alt="thumbnailOnly ? '' : item.description"
		@error="failed = true"
	>
	<span
		class="rp-evidence-file-metadata"
		:class="{ 'rp-visually-hidden': thumbnailOnly && thumbnail }"
	>{{ item.path }}{{ item.subpath }} · {{ tr(`planning.${item.phase}`) }}<template v-if="item.date"> · <time :datetime="item.date">{{ item.date }}</time></template></span>
	<span
		v-if="!file?.ok"
		class="rp-evidence-file-metadata"
		role="status"
	>
		{{ tr('planning.missing-file') }}
	</span>
	<span
		v-else-if="item.type === 'photo' && !thumbnail"
		class="rp-evidence-file-metadata"
	>
		{{ tr('planning.thumbnail-failed') }}
	</span>
</template>
