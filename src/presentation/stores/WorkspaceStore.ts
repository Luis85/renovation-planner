import { defineStore } from 'pinia';
import { ref } from 'vue';
import { defaultLayerVisibility, type KonvaLayerId } from '../editor/scene/KonvaLayers';
import type { LayoutMode } from '../editor/shell/layoutMode';

/**
 * Editor CHROME state (SDD §14): the per-Konva-layer visibility toggles the Layers panel
 * drives (§60), and the layout mode and overlay state (M16).
 *
 * Layer visibility is a pure RENDERING concern and not an edit — hiding the annotation
 * layer changes nothing persisted, which is why it belongs in an ephemeral store rather
 * than going through a command. Layout mode and overlay state are the same. Nothing here
 * reaches a repository, and reopening a Plan Editor starts from the defaults.
 *
 * **Which FULL-mode panels are open is deliberately not here** (2026-09-04, spec §5.6, R11).
 * `layersPanelOpen`/`inspectorPanelOpen` and their two toggles lived here for several tasks
 * with no production caller at all — §5.6 builds no View menu, because nothing would be in it
 * — so the shell renders both full-mode panels unconditionally and the two states that were
 * only ever reachable from a test are gone. The increment that builds a panel toggle re-adds
 * two refs and two actions, with a control that reaches them.
 */
export const useWorkspaceStore = defineStore('workspace', () => {
	const layerVisibility = ref<Record<KonvaLayerId, boolean>>(defaultLayerVisibility());
	const layoutMode = ref<LayoutMode>('full');
	const overlay = ref<'none' | 'layers' | 'inspector'>('none');

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

	/** Leaving `constrained` closes the overlay: the panels it stood in for are back. */
	function setLayoutMode(mode: LayoutMode): void {
		layoutMode.value = mode;
		if (mode !== 'constrained') overlay.value = 'none';
	}

	/** One overlay at a time (M16): opening one closes the other. */
	function openOverlay(kind: 'layers' | 'inspector'): void {
		overlay.value = kind;
	}

	function closeOverlay(): void {
		overlay.value = 'none';
	}

	/**
	 * Every layer visible and the layout back at its default — the state a Plan Editor opens in.
	 *
	 * Nothing here is persisted either, so "reset" means the same thing it means in
	 * `EditorStore.reset`: assign the declared defaults, because there is no stored value to
	 * re-read and no edit to discard. `defaultLayerVisibility()` is CALLED again rather than a
	 * snapshot being kept from the first call, so the record handed out is fresh and the
	 * defaults have one definition — the same bargain `EditorStore.reset` makes by importing
	 * `DEFAULT_VIEWPORT` rather than restating it.
	 *
	 * The consumer that exists today is the harness index (`tests/harness/fixture.ts` calls this
	 * before every entry it opens, so an overlay opened or a layer hidden by one entry does not
	 * draw the next); it is an example of what needs this, not the reason it exists.
	 */
	function reset(): void {
		layerVisibility.value = defaultLayerVisibility();
		layoutMode.value = 'full';
		overlay.value = 'none';
	}

	return {
		layerVisibility,
		toggleLayer,
		layoutMode,
		overlay,
		setLayoutMode,
		openOverlay,
		closeOverlay,
		reset,
	};
});
