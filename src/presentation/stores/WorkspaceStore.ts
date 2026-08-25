import { defineStore } from 'pinia';
import { ref } from 'vue';
import { defaultLayerVisibility, type KonvaLayerId } from '../editor/scene/KonvaLayers';

/**
 * Editor CHROME state (SDD §14): which shell regions are open, and the per-Konva-layer
 * visibility toggles the Layers panel drives (§60).
 *
 * Layer visibility is a pure RENDERING concern and not an edit — hiding the annotation
 * layer changes nothing persisted, which is why it belongs in an ephemeral store rather
 * than going through a command. Nothing here reaches a repository, and reopening a Plan
 * Editor starts from the defaults.
 */
export const useWorkspaceStore = defineStore('workspace', () => {
	const layersPanelOpen = ref(true);
	const inspectorPanelOpen = ref(true);
	const layerVisibility = ref<Record<KonvaLayerId, boolean>>(defaultLayerVisibility());

	function toggleLayersPanel(): void {
		layersPanelOpen.value = !layersPanelOpen.value;
	}

	function toggleInspectorPanel(): void {
		inspectorPanelOpen.value = !inspectorPanelOpen.value;
	}

	/**
	 * Internal: `toggleLayer` is the whole public surface, because a Layers panel offers a
	 * checkbox and nothing else. An exported setter with no caller is dead code by this
	 * project own gate; slice 6 exports one in the change that needs to set a layer without
	 * knowing its current state.
	 */
	function setLayerVisible(layer: KonvaLayerId, visible: boolean): void {
		// A NEW record rather than an in-place field write: the value is what a `v-layer`'s
		// `visible` config is bound to, and replacing the object is what makes the change one
		// reactive event rather than one per key for anything watching the whole record.
		layerVisibility.value = { ...layerVisibility.value, [layer]: visible };
	}

	function toggleLayer(layer: KonvaLayerId): void {
		setLayerVisible(layer, !layerVisibility.value[layer]);
	}

	/**
	 * Every field back to the value its `ref()` started at — the harness fixture's reset hook
	 * (`tests/harness/fixture.ts`), called before every entry the index opens so a panel closed
	 * or a layer hidden by one entry does not draw the next. `defaultLayerVisibility()` is
	 * called again rather than a snapshot kept from the first call, for the same reason
	 * `EditorStore.reset` imports `DEFAULT_VIEWPORT` rather than restating it.
	 */
	function reset(): void {
		layersPanelOpen.value = true;
		inspectorPanelOpen.value = true;
		layerVisibility.value = defaultLayerVisibility();
	}

	return {
		layersPanelOpen,
		inspectorPanelOpen,
		layerVisibility,
		toggleLayersPanel,
		toggleInspectorPanel,
		toggleLayer,
		reset,
	};
});
