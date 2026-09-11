<script setup lang="ts">
/** §17's asset layer: every placement drawn from its library shape, beneath annotations and above zones. */
import { computed } from 'vue';
import type { NodeTransform } from '../viewport/Viewport';
import type { ThemeTokens } from '../theme/themeTokens';
import { useProjectStore } from '../../stores/ProjectStore';
import { useAssetShapeStore } from '../../stores/AssetShapeStore';
import { useSelectionStore } from '../selection/selection-store';
import { useEditorRuntime } from '../runtime';
import { useDrawnStructure } from '../structure/drawnStructure';
import { withElementPreviews } from './elementPreviews';
import AssetShapes from './AssetShapes.vue';
const props = defineProps<{ transform: NodeTransform; tokens: ThemeTokens; visible: boolean; zoom: number }>();
const project = useProjectStore(), shapes = useAssetShapeStore(), selection = useSelectionStore(), runtime = useEditorRuntime();
const structure = useDrawnStructure();
const names = computed(() => new Map(project.plan?.spatialElements?.map(item => [item.id, item.name])));
const placements = computed(() => withElementPreviews((structure.value.elements ?? []).filter(element => element.kind === 'asset'), names.value, runtime.rotationActions.preview.value, runtime.elementActions.preview.value));
const preview = computed(() => {
	const draft = runtime.elementTask.assets.draft;
	return runtime.activeToolId.value === 'place-asset' && draft.preview && draft.shape
		? [{ id: 'element-preview', kind: 'asset' as const, assetId: draft.assetId, name: draft.name, points: draft.preview }] : [];
});
const previewShape = (assetId: string) => assetId === runtime.elementTask.assets.draft.assetId ? runtime.elementTask.assets.draft.shape : null;
</script>
<template>
	<VLayer :config="{ name: 'asset', listening: false, visible: props.visible, ...props.transform }">
		<AssetShapes
			:placements="placements"
			:shape-of="shapes.shapeOf"
			:selected-ids="selection.selectedIds"
			:hovered-id="runtime.renderState.hoveredObjectId"
			:tokens="tokens"
			:zoom="zoom"
		/>
		<AssetShapes
			:placements="preview"
			:shape-of="previewShape"
			:selected-ids="['element-preview']"
			:hovered-id="null"
			:tokens="tokens"
			:zoom="zoom"
		/>
	</VLayer>
</template>
