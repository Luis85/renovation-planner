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
const selectedSource = computed(() => props.sources.find(source => source === path.value.trim()) ?? null);
const selectedFilename = computed(() => {
	const source = selectedSource.value ?? path.value.trim();
	const separator = Math.max(source.lastIndexOf('/'), source.lastIndexOf('\\'));
	return separator >= 0 ? source.slice(separator + 1) : source;
});
function filename(source: string): string {
	const separator = Math.max(source.lastIndexOf('/'), source.lastIndexOf('\\'));
	return separator >= 0 ? source.slice(separator + 1) : source;
}
function choose(source: string): void {
	if (props.paused) return;
	path.value = source;
}
</script>
<template>
	<section>
		<div class="rp-reference-source-picker">
			<label class="rp-dialog-field">{{ tr('editor.reference.source') }}<input
				v-model="path"
				name="source"
				:list="sourceList"
				type="search"
				:readonly="paused"
				autocomplete="off"
			></label>
			<div
				class="rp-reference-source-list"
				role="group"
				:aria-label="tr('editor.reference.source')"
			>
				<button
					v-for="candidate in matches"
					:key="candidate"
					type="button"
					class="rp-reference-source-option"
					:class="{ 'is-selected': candidate === selectedSource }"
					:aria-pressed="candidate === selectedSource"
					:disabled="paused"
					:data-rp-reference-source="candidate"
					:title="candidate"
					@click="choose(candidate)"
				>
					<span class="rp-reference-source-option__filename">{{ filename(candidate) }}</span>
					<span class="rp-reference-source-option__path">{{ candidate }}</span>
				</button>
				<p
					v-if="matches.length === 0"
					class="rp-reference-source-list__empty"
				>
					{{ tr('editor.reference.source-help') }}
				</p>
			</div>
		</div>
		<datalist :id="sourceList">
			<option
				v-for="candidate in matches"
				:key="candidate"
				:value="candidate"
			/>
		</datalist>
		<p>{{ tr('editor.reference.source-help') }}</p>
		<p
			v-if="selectedFilename"
			class="rp-reference-source-context"
			aria-live="polite"
		>
			<strong>{{ selectedFilename }}</strong>
			<span>{{ path.trim() }}</span>
		</p>
		<details
			v-if="pdf"
			class="rp-reference-disclosure"
		>
			<summary>{{ tr('editor.reference.page') }}</summary>
			<label class="rp-dialog-field">{{ tr('editor.reference.page') }}<input
				v-model="page"
				name="page"
				type="number"
				min="1"
				:readonly="paused"
			></label>
		</details>
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
		<details
			v-if="hasRaster"
			class="rp-reference-disclosure"
		>
			<summary>{{ tr('editor.reference.rotation') }} · {{ tr('editor.reference.crop-width') }}</summary>
			<div class="rp-reference-grid">
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
		</details>
	</section>
</template>
