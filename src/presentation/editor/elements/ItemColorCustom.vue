<script setup lang="ts">
import { computed } from 'vue';
import { isHexColor, type ItemColor } from '../../../domain/spatial/ItemColor';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { itemColorRgb } from './itemColorAppearance';
const props = defineProps<{ color?: ItemColor; disabled: boolean }>();
const emit = defineEmits<{ choose: [color: ItemColor] }>();
const custom = computed(() => isHexColor(props.color));
/** The native input needs a `#rrggbb`: the saved colour's sample, or a neutral grey to start from. */
const value = computed(() => props.color === undefined ? '#808080' : itemColorRgb(props.color));
const label = computed(() => custom.value ? tr('editor.item-color.custom-value', { value: String(props.color) }) : tr('editor.item-color.custom'));
/** `change`, never `input`: a drag through the OS picker is one write (plan colours design §3). */
function change(event: Event): void {
	const next = (event.target as HTMLInputElement).value.toLowerCase();
	if (!props.disabled && isHexColor(next)) emit('choose', next);
}
</script>
<template>
	<label
		class="rp-item-color__custom"
		:title="disabled ? tr('editor.input.unavailable') : label"
	>
		<input
			type="color"
			data-rp-item-color="custom"
			:value="value"
			:aria-label="label"
			:aria-disabled="disabled"
			@change="change"
		>
		<HostIcon
			v-if="custom"
			class="rp-item-color__check"
			name="circle-check"
		/>
	</label>
</template>
