<script setup lang="ts">
/** The Inspector keeps native input identity while the shell changes its presentation. */
import { tr } from '../../i18n/strings';
defineProps<{ floating: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
	<div
		:class="floating ? 'rp-inspector-drawer' : 'rp-persistent-panel'"
		:tabindex="floating ? -1 : undefined"
	>
		<button
			v-if="floating"
			type="button"
			class="rp-inspector-drawer__close"
			@click="emit('close')"
		>
			{{ tr('editor.overlay.close') }}
		</button>
		<slot />
	</div>
</template>
