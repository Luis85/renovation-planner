<script setup lang="ts">
/** The Layers outlet stays mounted; only its column/overlay chrome changes. */
import { tr } from '../../i18n/strings';
defineProps<{ floating: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
	<div
		:class="floating ? 'rp-overlay-panel' : 'rp-persistent-panel'"
		:tabindex="floating ? -1 : undefined"
	>
		<button
			v-if="floating"
			type="button"
			class="rp-overlay-panel__close"
			@click="emit('close')"
		>
			{{ tr('editor.overlay.close') }}
		</button>
		<slot />
	</div>
</template>
