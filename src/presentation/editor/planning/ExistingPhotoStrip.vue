<script setup lang="ts">
import type { Evidence } from '../../../domain/renovation/PlanningDepth';
import EvidenceGallery from './EvidenceGallery.vue';
import { tr } from '../../i18n/strings';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
const props = defineProps<{ rows: readonly Evidence[] }>();
const root = ref<HTMLElement | null>(null);
async function preserveOwnedFocus(): Promise<void> {
	const element = root.value, focused = element?.ownerDocument.activeElement;
	if (!focused || !element?.contains(focused)) return;
	const canvas = element.closest<HTMLElement>('.rp-plan-canvas'), document = element.ownerDocument;
	await nextTick();
	if (canvas?.isConnected && !focused.isConnected && document.activeElement === document.body) canvas.focus();
}
watch(() => props.rows, preserveOwnedFocus, { flush: 'pre' });
onBeforeUnmount(preserveOwnedFocus);
</script>
<template>
	<aside
		ref="root"
		class="rp-existing-photo-strip"
		:aria-label="tr('renovation.photos')"
	>
		<EvidenceGallery
			:rows="rows"
			:is-selected="() => false"
		/>
	</aside>
</template>
