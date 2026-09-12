import { defineStore } from 'pinia';
import { ref } from 'vue';
import { defaultLayerVisibility, type KonvaLayerId } from '../editor/scene/KonvaLayers';
import type { LayoutMode } from '../editor/shell/layoutMode';
import { clampPanelWidth, defaultPanelLayout, type PanelLayout, type PanelSide, type PanelState } from '../editor/shell/panelLayout';

/**
 * Editor CHROME state (SDD §14): the per-Konva-layer visibility toggles the Layers panel
 * drives (§60), and the layout mode and overlay state (M16).
 *
 * Layer visibility is a pure RENDERING concern and not an edit — hiding the annotation
 * layer changes nothing persisted, which is why it belongs in an ephemeral store rather
 * than going through a command. Layout mode and overlay state are the same. Nothing here
 * reaches a repository, and reopening a Plan Editor starts from the defaults — except two
 * things that outlive the leaf, each in its own per-device slot: `gridVisible`, which
 * `PlanEditorRoot` seeds from and writes back to `PlanEditorContext.viewPreferences`, and the
 * side panels' layout below.
 *
 * **The full-mode side panels' widths and collapsed state ARE here** (2026-09-12 side panels
 * spec): `ResponsiveEditorShell` restores them from `PlanEditorContext.panelLayout` on mount and
 * writes them back on every committed change. The store itself still reaches no repository. The View menu owns grid visibility and automatic
 * object snapping; neither changes the floor or a saved record. Each leaf has its own Pinia scope.
 */
export const useWorkspaceStore = defineStore('workspace', () => {
	const layerVisibility = ref<Record<KonvaLayerId, boolean>>(defaultLayerVisibility());
	const layoutMode = ref<LayoutMode>('full');
	const overlay = ref<'none' | 'layers' | 'inspector'>('none');
	const gridVisible = ref(false);
	/** The View menu's north arrow; the bearing it shows is the plan's own and IS saved. */
	const northVisible = ref(false);

	/**
	 * Whether evidence pins — notes and photos — are drawn. The Layers panel's "Notes and
	 * photos" row (sidebar polish, 2026-09-10). Not a Konva layer: the annotation layer draws
	 * the pins and the zone layer uses the same list for caption clearance, so the gate sits
	 * where `PlanCanvas` computes the pin list rather than on either layer's `visible`.
	 */
	const notesVisible = ref(true);

	function toggleNotes(): void {
		notesVisible.value = !notesVisible.value;
	}

	/** Both side panels in the full layout — see `panelLayout.ts`. Replaced, never mutated. */
	const panelLayout = ref<PanelLayout>(defaultPanelLayout());

	function setPanel(side: PanelSide, patch: Partial<PanelState>): void {
		const next = { ...panelLayout.value[side], ...patch };
		panelLayout.value = { ...panelLayout.value, [side]: { width: clampPanelWidth(side, next.width), collapsed: next.collapsed } };
	}

	function restorePanelLayout(layout: PanelLayout): void {
		panelLayout.value = layout;
	}

	/**
	 * Internal: `toggleLayer` is the whole public surface for a Konva layer's own visibility
	 * — `toggleNotes` is the separate, public surface for the notes gate below, which is not
	 * a Konva layer at all. A Layers panel offers a checkbox and nothing else for either. An
	 * exported setter with no caller is dead code by this project's own gate; slice 6 exports
	 * one in the change that needs to set a layer without knowing its current state.
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
	 * The ONE reveal for a task whose form or target lives in the Inspector: the overlay in
	 * `constrained`, the panel itself otherwise, where a collapsed Inspector hides the form in a
	 * `display: none` body. The expand is the task's rather than the user's, so nothing here writes
	 * storage — `ResponsiveEditorShell` persists only the user's own commits.
	 */
	function revealInspector(): void {
		if (layoutMode.value === 'constrained') overlay.value = 'inspector';
		else setPanel('inspector', { collapsed: false });
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
		gridVisible.value = false;
		northVisible.value = false;
		layerVisibility.value = defaultLayerVisibility();
		layoutMode.value = 'full';
		overlay.value = 'none';
		notesVisible.value = true;
		panelLayout.value = defaultPanelLayout();
	}

	return {
		gridVisible,
		northVisible,
		layerVisibility,
		toggleLayer,
		notesVisible,
		toggleNotes,
		layoutMode,
		overlay,
		setLayoutMode,
		openOverlay,
		closeOverlay,
		revealInspector,
		panelLayout,
		setPanel,
		restorePanelLayout,
		reset,
	};
});
