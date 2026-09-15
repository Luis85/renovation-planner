<script setup lang="ts">
import { computed, ref } from 'vue';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { tr } from '../../i18n/strings';
import OpeningDirectPanel from './OpeningDirectPanel.vue';

const project = useProjectStore(), selection = useSelectionStore(), dock = ref<HTMLElement | null>(null);
const opening = computed(() => selection.selectedIds.length === 1 ? project.structure.openings.find(item => item.id === selection.selectedIds[0] && item.kind !== 'opening') : undefined);
const identity = computed(() => opening.value ? tr('editor.opening.direct.title', { opening: tr(`editor.add.${opening.value.kind}.label`) }) : '');
const host = computed(() => tr('editor.structure.wall-number', { n: String(project.structure.walls.findIndex(item => item.id === opening.value?.hostId) + 1) }));
</script>
<template>
	<section
		v-if="opening"
		class="rp-opening-direct-narrow"
		:aria-label="identity"
	>
		<h3>{{ identity }}</h3>
		<p>{{ tr('editor.opening.direct.host', { host }) }}</p>
		<OpeningDirectPanel
			:dock="dock"
			nonspatial
		/>
		<div ref="dock" />
	</section>
</template>
