<script setup lang="ts">
import { tr } from '../../i18n/strings';

defineProps<{ points: readonly { label: string; selected: boolean; coordinates: string; state: string }[]; paused: boolean }>();
const emit = defineEmits<{ another: [] }>();
const ax = defineModel<string>('ax', { required: true });
const ay = defineModel<string>('ay', { required: true });
const bx = defineModel<string>('bx', { required: true });
const by = defineModel<string>('by', { required: true });
const length = defineModel<string>('length', { required: true });
const coordinateFields = [
	{ key: 'ax', model: ax }, { key: 'ay', model: ay },
	{ key: 'bx', model: bx }, { key: 'by', model: by },
] as const;
</script>

<template>
	<section class="rp-reference-measure">
		<p class="rp-reference-measure__help">
			{{ tr('editor.reference.measure-help') }}
		</p>
		<ol
			class="rp-reference-point-progress"
			:aria-label="tr('editor.reference.preview')"
		>
			<li
				v-for="point in points"
				:key="point.label"
				:class="{ 'is-selected': point.selected }"
				:data-rp-reference-point="point.label.toLowerCase()"
			>
				<strong>{{ point.label }}</strong>
				<span>{{ point.state }}</span>
				<output>{{ point.coordinates }}</output>
			</li>
		</ol>
		<label class="rp-dialog-field rp-reference-measure__length">{{ tr('editor.reference.length') }}<input
			v-model="length"
			name="length"
			type="text"
			inputmode="decimal"
			:readonly="paused"
		></label>
		<details class="rp-reference-disclosure">
			<summary>{{ tr('editor.reference.exact-points') }}</summary>
			<div class="rp-reference-grid">
				<label
					v-for="field in coordinateFields"
					:key="field.key"
					class="rp-dialog-field"
				>{{ tr(`editor.reference.${field.key}`) }}<input
					v-model="field.model.value"
					:name="field.key"
					type="number"
					step="any"
					:readonly="paused"
				></label>
			</div>
		</details>
		<button
			type="button"
			:aria-disabled="paused"
			data-rp-reference-action="another-distance"
			@click="!paused && emit('another')"
		>
			{{ tr('editor.reference.another') }}
		</button>
	</section>
</template>
