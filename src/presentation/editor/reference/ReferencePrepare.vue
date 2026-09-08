<script setup lang="ts">
import { computed, useId } from 'vue';
import { tr } from '../../i18n/strings';
const props = defineProps<{ sources: readonly string[]; pdf: boolean; paused: boolean; loading: boolean; hasRaster: boolean }>();
const path = defineModel<string>('path', { required: true });
const page = defineModel<number>('page', { required: true });
const rotation = defineModel<number>('rotation', { required: true });
const crop = defineModel<{ x: number; y: number; width: number; height: number }>('crop', { required: true });
const emit = defineEmits<{ load: [] }>();
const sourceList = useId();
const matches = computed(() => {
	const query = path.value.trim().toLowerCase(), choices: string[] = [];
	for (const source of props.sources) {
		if (!source.toLowerCase().includes(query)) continue;
		choices.push(source);
		if (choices.length === 20) break;
	}
	return choices;
});
</script>
<template>
	<section>
		<label class="rp-dialog-field">{{ tr('editor.reference.source') }}<input
			v-model="path"
			name="source"
			:list="sourceList"
			type="text"
			:readonly="paused"
		></label>
		<datalist :id="sourceList">
			<option
				v-for="candidate in matches"
				:key="candidate"
				:value="candidate"
			/>
		</datalist>
		<p>{{ tr('editor.reference.source-help') }}</p>
		<label
			v-if="pdf"
			class="rp-dialog-field"
		>{{ tr('editor.reference.page') }}<input
			v-model="page"
			name="page"
			type="number"
			min="1"
			:readonly="paused"
		></label>
		<button
			type="button"
			data-rp-action="load-reference"
			:aria-disabled="paused || loading"
			@click="emit('load')"
		>
			{{ tr('editor.reference.load') }}
		</button>
		<p
			v-if="loading"
			role="status"
		>
			{{ tr('editor.reference.loading') }}
		</p>
		<div
			v-if="hasRaster"
			class="rp-reference-grid"
		>
			<label
				v-for="key in (['x', 'y', 'width', 'height'] as const)"
				:key="key"
				class="rp-dialog-field"
			>{{ tr(`editor.reference.crop-${key}`) }}<input
				v-model.number="crop[key]"
				:name="`crop-${key}`"
				type="number"
				step="any"
				:readonly="paused"
			></label>
			<label class="rp-dialog-field">{{ tr('editor.reference.rotation') }}<input
				v-model.number="rotation"
				name="rotation"
				type="number"
				min="-180"
				max="180"
				:readonly="paused"
			></label>
		</div>
	</section>
</template>
