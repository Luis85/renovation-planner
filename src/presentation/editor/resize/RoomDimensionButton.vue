<script setup lang="ts">
import type { DimensionsText } from './roomDimensions';
import { tr } from '../../i18n/strings';
defineProps<{ axis: keyof DimensionsText; text: string; disabled: boolean }>();
const emit = defineEmits<{ click: [] }>();
</script>
<template>
	<button
		type="button"
		class="rp-dimension-label"
		:data-rp-dimension="axis"
		:aria-disabled="disabled"
		:aria-label="tr(axis === 'width' ? 'editor.dimension.edit-width' : 'editor.dimension.edit-depth', { value: text })"
		@click="emit('click')"
	>
		{{ text }} m
	</button>
</template>
