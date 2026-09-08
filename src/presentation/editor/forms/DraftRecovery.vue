<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { tr } from '../../i18n/strings';
import { useSaveStateStore } from '../save-state/save-state-store';
const props = defineProps<{ retry: () => Promise<void>; openSource: () => Promise<void> }>();
const save = useSaveStateStore();
const reading = ref(false);
const root = ref<HTMLElement | null>(null);
onBeforeUnmount(() => {
 if (root.value?.contains(document.activeElement)) root.value.closest('form')?.querySelector<HTMLElement>('input, select, textarea')?.focus();
});
async function tryAgain(): Promise<void> {
 if (reading.value || save.unrecoveredWrite) return;
 reading.value = true;
 try { await props.retry(); } finally { reading.value = false; }
}
</script>
<template>
	<section
		ref="root"
		class="rp-draft-recovery"
		aria-live="polite"
	>
		<p>{{ tr(save.unrecoveredWrite ? 'planning.recovery.unrecovered' : 'planning.recovery.draft') }}</p>
		<button
			v-if="!save.unrecoveredWrite"
			type="button"
			:aria-disabled="reading"
			@click="tryAgain"
		>
			{{ tr('planning.retry') }}
		</button>
		<button
			type="button"
			@click="openSource"
		>
			{{ tr('editor.warning.open-source-note') }}
		</button>
	</section>
</template>
