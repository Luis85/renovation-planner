<script setup lang="ts">
import { computed } from 'vue';
import type { ItemColorPreset } from '../../../domain/spatial/ItemColor';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import { ITEM_COLOR_RGB } from './itemColorAppearance';
const props = defineProps<{ color?: ItemColorPreset; selected: boolean; disabled: boolean; menu?: boolean }>();
const emit = defineEmits<{ choose: [] }>();
const label = computed(() => tr(`editor.item-color.${props.color ?? 'default'}`));
const pigment = computed(() => props.color ? { backgroundColor: ITEM_COLOR_RGB[props.color] } : undefined);
</script>
<template>
	<button
		type="button"
		class="rp-item-color__choice"
		:role="menu ? 'menuitemradio' : undefined"
		:tabindex="menu ? -1 : 0"
		:aria-checked="menu ? selected : undefined"
		:aria-pressed="menu ? undefined : selected"
		:aria-disabled="disabled"
		:aria-label="label"
		:title="disabled ? tr('editor.input.unavailable') : label"
		:data-rp-item-color="color ?? 'default'"
		@click="emit('choose')"
	>
		<span
			class="rp-item-color__chip"
			:style="pigment"
			aria-hidden="true"
		>
			<HostIcon
				v-if="color === undefined"
				name="rotate-ccw"
			/>
		</span>
		<HostIcon
			v-if="selected"
			class="rp-item-color__check"
			name="circle-check"
		/>
	</button>
</template>
