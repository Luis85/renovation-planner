<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue';
import { isEvidenceImage, type EvidenceFiles } from '../../../application/ports/EvidenceFiles';
import { tr } from '../../i18n/strings';
const path = defineModel<string>({ required: true });
const props = defineProps<{ files?: EvidenceFiles; imagesOnly: boolean; paused: boolean }>();
const id = useId(), queryText = ref(path.value);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(path, value => { clearTimeout(timer); timer = setTimeout(() => { queryText.value = value; }, 150); });
onBeforeUnmount(() => clearTimeout(timer));
const suggestions = computed(() => {
	const query = queryText.value.trim().toLowerCase(), results: string[] = [];
	for (const candidate of props.files?.list({ query, imagesOnly: props.imagesOnly, limit: 20 }) ?? []) {
		if ((props.imagesOnly && !isEvidenceImage(candidate)) || !candidate.toLowerCase().includes(query)) continue;
		results.push(candidate);
		if (results.length === 20) break;
	}
	return results;
});
</script>
<template>
	<label>{{ tr(imagesOnly ? 'planning.photo.image' : 'planning.path') }}<input
		v-model="path"
		name="path"
		:list="id"
		:readonly="paused"
		:placeholder="tr('planning.file-search')"
	></label>
	<datalist :id="id">
		<option
			v-for="candidate in suggestions"
			:key="candidate"
			:value="candidate"
		/>
	</datalist>
</template>
