<script setup lang="ts">
/**
 * The Konva stage: §17's seven layers in their fixed order, sized to the pane. The camera
 * those layers are drawn through, and every gesture that moves it, is one level out in
 * `surface/EditorSurface.vue`; this file hands that surface its layers and its slot.
 *
 * Every layer sets `listening: false`. There is no interactive tool yet to receive pointer
 * events, and per §62 an inert hit graph on layers nothing interacts with is pure cost —
 * Konva would maintain a second, hidden canvas per layer for nothing. Slice 6 turns
 * listening on selectively, per node, without restructuring this list. The camera itself
 * therefore listens on `EditorSurface`'s DOM container rather than on the Stage, which is
 * also what lets it keep working once individual nodes start listening.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useEditorStore } from '../stores/EditorStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import type { ThemeTokens } from './theme/themeTokens';
import { viewportTransform } from './viewport/Viewport';
import { useProjectStore } from '../stores/ProjectStore';
import { useSelectionStore } from './selection/selection-store';
import { boundsOfZones } from './viewport/zoneExtent';
import { useEditorRuntime } from './runtime';
import type { BackgroundStatus } from './layers/background/BackgroundRenderModel';
import EditorSurface from './surface/EditorSurface.vue';
import BackgroundLayer from './layers/background/BackgroundLayer.vue';
import EmptyLayer from './layers/EmptyLayer.vue';
import InteractionLayer from './layers/InteractionLayer.vue';
import ZoneLayer from './layers/zone/ZoneLayer.vue';

const props = defineProps<{ tokens: ThemeTokens }>();
const emit = defineEmits<{ backgroundStatus: [status: BackgroundStatus] }>();

const editor = useEditorStore();
const workspace = useWorkspaceStore();
const project = useProjectStore();
const selection = useSelectionStore();
const runtime = useEditorRuntime();
const { viewport } = storeToRefs(editor);
const { layerVisibility } = storeToRefs(workspace);

const transform = computed(() => viewportTransform(viewport.value));

/**
 * What the fit shortcuts frame — everything, or just what is selected — answered HERE because
 * it is the one thing they ask that names a Plan's own contents. `EditorSurface` owns the
 * keystroke and the camera; this owns the zones.
 *
 * A fit with nothing to frame does NOTHING, which is why `boundsOfZones` answers `null` rather
 * than defaulting: a jump to nowhere costs the user the view they had and tells them nothing
 * about why.
 */
function framedBounds(all: boolean) {
	const zones = [...project.zones.values()];
	const framed = all
		? zones
		: zones.filter((zone) => selection.selectedIds.some((id) => String(id) === zone.id));

	return boundsOfZones(framed);
}
</script>

<template>
	<EditorSurface
		:tool-manager="runtime.toolManager"
		:active-tool-id="runtime.activeToolId"
		:editor="editor"
		:framed-bounds="framedBounds"
	>
		<template #default="{ size }">
			<VStage :config="size">
				<BackgroundLayer
					:transform="transform"
					:visible="layerVisibility.background"
					@status="(status) => emit('backgroundStatus', status)"
				/>
				<EmptyLayer
					layer-id="architecture"
					:transform="transform"
					:visible="layerVisibility.architecture"
				/>
				<ZoneLayer
					:transform="transform"
					:tokens="props.tokens"
					:visible="layerVisibility.zone"
					:zoom="viewport.zoom"
				/>
				<EmptyLayer
					layer-id="construction"
					:transform="transform"
					:visible="layerVisibility.construction"
				/>
				<EmptyLayer
					layer-id="asset"
					:transform="transform"
					:visible="layerVisibility.asset"
				/>
				<EmptyLayer
					layer-id="annotation"
					:transform="transform"
					:visible="layerVisibility.annotation"
				/>
				<InteractionLayer
					:tokens="props.tokens"
				/>
			</VStage>
		</template>
		<template #overlay>
			<slot />
		</template>
	</EditorSurface>
</template>
