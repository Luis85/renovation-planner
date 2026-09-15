<script setup lang="ts">
import type { WallSide } from '../../../domain/spatial/Structure';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
defineProps<{ side: WallSide; value: string; paused: boolean; invalid: boolean; describedBy: string; steps: boolean; decrease: boolean; increase: boolean }>();
const emit = defineEmits<{ update: [value: string]; focus: [side: WallSide | null]; hover: [side: WallSide | null]; step: [direction: -1 | 1] }>();
</script>
<template>
	<div
		class="rp-wall-side-field"
		:data-wall-side="side"
		@mouseenter="emit('hover', side)"
		@mouseleave="emit('hover', null)"
		@focusin="emit('focus', side)"
		@focusout="!($event.currentTarget as HTMLElement).contains($event.relatedTarget as Node | null) && emit('focus', null)"
	>
		<label class="rp-dialog-field">
			{{ tr('editor.wall-side.label', { side: side.toUpperCase() }) }}
			<input
				:name="`wall-side-${side}`"
				type="text"
				inputmode="decimal"
				:value="value"
				:readonly="paused"
				:aria-invalid="invalid"
				:aria-describedby="describedBy"
				@input="emit('update', ($event.target as HTMLInputElement).value)"
			>
		</label>
		<div
			v-if="steps"
			class="rp-wall-thickness-stepper"
		>
			<button
				type="button"
				:aria-label="tr('editor.wall-side.decrease', { side: side.toUpperCase() })"
				:aria-disabled="!decrease"
				@click="decrease && emit('step', -1)"
			>
				<HostIcon name="minus" />
			</button>
			<span>10 mm</span>
			<button
				type="button"
				:aria-label="tr('editor.wall-side.increase', { side: side.toUpperCase() })"
				:aria-disabled="!increase"
				@click="increase && emit('step', 1)"
			>
				<HostIcon name="plus" />
			</button>
		</div>
	</div>
</template>
