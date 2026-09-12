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
import { useEvidencePins } from './planning/evidencePins';
import { useExistingPhotos } from './planning/existingPhotos';
import ExistingPhotoStrip from './planning/ExistingPhotoStrip.vue';
import type { Point } from '../../core/geometry/Point';
import { computed, shallowRef, watch } from 'vue';
import type { DimensionObstacleLayout } from './resize/useDimensionObstacles';
import { storeToRefs } from 'pinia';
import { useEditorStore } from '../stores/EditorStore';
import { useWorkspaceStore } from '../stores/WorkspaceStore';
import type { ThemeTokens } from './theme/themeTokens';
import { viewportTransform } from './viewport/Viewport';
import { useProjectStore } from '../stores/ProjectStore';
import { usePlanEditorContext } from './PlanEditorContext';
import { useSelectionStore } from './selection/selection-store';
import { boundsOfZones } from './viewport/zoneExtent';
import { useEditorRuntime } from './runtime';
import type { BackgroundStatus } from './layers/background/BackgroundRenderModel';
import EditorSurface from './surface/EditorSurface.vue';
import type { StringKey } from '../i18n/locales/en';
import BackgroundLayer from './layers/background/BackgroundLayer.vue';
import ParentZoneGuide from './hierarchy/ParentZoneGuide.vue';
import EmptyLayer from './layers/EmptyLayer.vue';
import InteractionLayer from './layers/InteractionLayer.vue';
import ZoneLayer from './layers/zone/ZoneLayer.vue';
import StructureLayer from './structure/StructureLayer.vue';
import AssetLayer from './elements/AssetLayer.vue';
import RenovationLayer from './renovation/RenovationLayer.vue';
import { usePlanFrame } from './viewport/usePlanFrame';
import { usePlanHierarchyStore } from '../stores/PlanHierarchyStore';
import { guideFramePoints } from './hierarchy/parentZoneGuide';
import CanvasGrid from './layers/CanvasGrid.vue';
import RoomDimensionLabels from './resize/RoomDimensionLabels.vue';
import DirectActionPopover from './selection/DirectActionPopover.vue';

/** This surface's own subject, which `EditorSurface` requires rather than assuming. */
const CANVAS_LABEL: StringKey = 'editor.canvas';

const props = defineProps<{ tokens: ThemeTokens }>();
const emit = defineEmits<{ backgroundStatus: [status: BackgroundStatus] }>();

const editor = useEditorStore();
const workspace = useWorkspaceStore();
const project = useProjectStore();
const selection = useSelectionStore();
const runtime = useEditorRuntime();
// Pins and caption obstacles use the same retained evidence facts as the Inspector.
const allEvidencePins = useEvidencePins(() => runtime.planning.baseline.value?.plan.entity.renovation?.depth?.evidence ?? []);
/** The Layers panel's Notes and photos row: one gate over the pins the annotation layer draws and the zone layer clears captions around (sidebar polish, 2026-09-10). */
const evidencePins = computed(() => (workspace.notesVisible ? allEvidencePins.value : []));
const existingPhotos = useExistingPhotos();
const dimensionLayout = shallowRef<DimensionObstacleLayout>({ bounds: [], viewport: null });
const context = usePlanEditorContext();
const { viewport } = storeToRefs(editor);
const { layerVisibility } = storeToRefs(workspace);

/**
 * WHICH document the background layer draws, answered here because it is the one question
 * that layer asks that names a Plan — the same split `framedBounds` below already makes for
 * the fit shortcuts. `BackgroundLayer` reads no store and no context of its own since the
 * asset designer became its second mounter.
 */
const background = computed(() => project.plan?.background ?? null);

/** The plan's calibration as the ONE number the raster's drawn size needs; `1` uncalibrated. */
const pixelsPerWorldUnit = computed(() => project.plan?.calibration?.pixelsPerWorldUnit ?? 1);

const transform = computed(() => viewportTransform(viewport.value));

/**
 * What the fit shortcuts frame — everything, or just what is selected — answered HERE because
 * it is the one thing they ask that names a Plan's own contents. `EditorSurface` owns the
 * keystroke and the camera; this combines zones with the visible prepared reference.
 *
 * A fit with nothing to frame does NOTHING, which is why `boundsOfZones` answers `null` rather
 * than defaulting: a jump to nowhere costs the user the view they had and tells them nothing
 * about why.
 */
const { referencePoints } = storeToRefs(editor);
function onReferencePoints(points: readonly Point[]): void { referencePoints.value = points; }
const planHierarchy = usePlanHierarchyStore();
watch([referencePoints, () => planHierarchy.hierarchy.parentZone, () => editor.stageSize, () => layerVisibility.value.background], ([points, parentZone]) => {
 const bounds = boundsOfZones([{ points }, { points: guideFramePoints(parentZone) }]);
 if (bounds !== null && project.zones.size === 0 && project.structure.walls.length === 0 && !project.structure.elements?.length && layerVisibility.value.background && runtime.activeToolId.value === 'select') editor.fitTo(bounds, editor.stageSize);
}, { flush: 'post' });
const framedBounds = usePlanFrame();
// A plan opens framed on what has been drawn in it, not at world 0,0: once, the first time the
// stage has an area. A remount (the shell dropping the canvas below its floor width) finds the
// stage already measured and keeps the camera the user left.
watch(() => editor.stageSize.width > 0 && editor.stageSize.height > 0, () => {
	const bounds = framedBounds(true, false);
	if (bounds !== null) editor.fitTo(bounds, editor.stageSize);
}, { once: true });
</script>

<template>
	<EditorSurface
		:tool-manager="runtime.toolManager"
		:active-tool-id="runtime.activeToolId"
		:render-state="runtime.renderState"
		:editor="editor"
		:framed-bounds="framedBounds"
		:canvas-label="CANVAS_LABEL"
		:set-tool="runtime.setTool"
		:has-selection="() => selection.selectedIds.length > 0"
		:clear-selection="() => selection.clear()"
		:nudge-selection="runtime.nudgeSelection"
		:finish-area="runtime.finishArea"
	>
		<template #default="{ size }">
			<CanvasGrid />
			<VStage :config="size">
				<BackgroundLayer
					name="background"
					:reference="background"
					:vault="context.vault"
					:transform="transform"
					:visible="layerVisibility.background"
					:pixels-per-world-unit="pixelsPerWorldUnit"
					:file-changes="context.onVaultFileChanged"
					@status="(status) => emit('backgroundStatus', status)"
					@reference-points="onReferencePoints"
				>
					<ParentZoneGuide
						:tokens="props.tokens"
						:zoom="viewport.zoom"
					/>
				</BackgroundLayer>
				<StructureLayer
					:transform="transform"
					:tokens="props.tokens"
					:zoom="viewport.zoom"
					:visible="layerVisibility.architecture"
				/>
				<ZoneLayer
					:preview="(runtime.curveTask.preview.value ?? runtime.groupActions.preview.value)?.objects"
					:pins="evidencePins"
					:dimension-obstacles="dimensionLayout.bounds"
					:caption-viewport="dimensionLayout.viewport"
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
				<AssetLayer
					:transform="transform"
					:tokens="props.tokens"
					:zoom="viewport.zoom"
					:visible="layerVisibility.asset"
				/>
				<RenovationLayer
					:pins="evidencePins"
					:tokens="props.tokens"
					:transform="transform"
					:zoom="viewport.zoom"
					:visible="layerVisibility.annotation"
				/>
				<InteractionLayer
					:tokens="props.tokens"
				/>
			</VStage>
		</template>
		<template #overlay>
			<RoomDimensionLabels
				:preview="runtime.curveTask.preview.value ?? runtime.groupActions.preview.value"
				@obstacles="layout => { dimensionLayout = layout; }"
				@rotation-obstacles="runtime.rotationActions.setObstacles"
			/>
			<DirectActionPopover v-if="!existingPhotos.length" />
			<ExistingPhotoStrip
				v-else
				:rows="existingPhotos"
			/>
			<slot />
		</template>
	</EditorSurface>
</template>
