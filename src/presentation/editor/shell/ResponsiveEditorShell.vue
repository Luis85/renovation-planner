<script setup lang="ts">
/**
 * The editor's layout (design spec §5.4): six named slots arranged three ways, decided by the
 * width of this component's own root and nothing else.
 *
 * It owns the `ResizeObserver` and writes `WorkspaceStore.layoutMode`; it owns nothing else.
 * Everything it arranges is a SLOT rather than an import, so `PlanEditorRoot` keeps deciding
 * what a region contains — which plan the canvas draws, which failure replaces it — and this
 * component keeps deciding only where those regions go.
 *
 * **The canvas slot is rendered ONCE, outside the mode branches, and that is the whole design
 * rather than a tidiness.** A `<slot name="canvas" />` inside a `full` branch and a second one
 * inside a `constrained` branch are two different positions in the render tree: Vue tears the
 * first down and mounts the second on the switch, so a user dragging a split narrower would
 * lose the camera, the Konva stage and the in-flight gesture and get an identical-looking
 * canvas back. One outlet under one `v-if` is patched in place instead, which makes "viewport
 * and selection survive a layout change" true by construction rather than by a watcher that
 * restores them. The PANEL and INSPECTOR slots really are rendered twice — column and overlay —
 * and may remount, because neither holds anything a remount would lose.
 *
 * **Every branch is its own `v-if` rather than a `v-if`/`v-else` chain**, so Vue keeps a
 * comment placeholder for each inactive one and the children of `.rp-editor-body` stay in the
 * same positions across a mode change. That is what lets the canvas outlet be patched rather
 * than re-created when the panels around it appear and disappear.
 *
 * **The mode is measured in `onMounted` as well as on every observer callback** — one function,
 * two callers. The real `ResizeObserver` reports once on `observe()`, so the second measurement
 * would be enough in a browser; the first is what makes the mode a fact about a REAL width in
 * hosts that do not, rather than about the 0 an unlaid-out element reports.
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { layoutModeFor, type LayoutMode } from './layoutMode';
import InspectorDrawer from './InspectorDrawer.vue';
import OverlayPanel from './OverlayPanel.vue';
import PanelRail from './PanelRail.vue';
import UnsupportedWidthNotice from './UnsupportedWidthNotice.vue';

const workspace = useWorkspaceStore();
const { layoutMode, overlay } = storeToRefs(workspace);

const root = ref<HTMLElement | null>(null);
/**
 * Definitely assigned in `onMounted`, which Vue runs before `onBeforeUnmount` for any component
 * that ever mounted — the house spelling for a local a lifecycle hook fills in, rather than a
 * `null` that every later read has to narrow past.
 */
let observer!: ResizeObserver;

/**
 * Which persistent region inherits focus when a GROWTH closes an overlay (R10), or `null` when
 * this measurement closes nothing — which is every ordinary resize.
 *
 * Asked BEFORE `setLayoutMode`, because that call clears `overlay` in the same statement, so
 * afterwards there is nothing left to say which of the two the user was operating.
 *
 * The target is the persistent ASIDE the overlay stood in for, and not its first control: the
 * aside is what the overlay was standing in for, while a control is a guess about which one
 * mattered. `closeOverlay` cannot serve here either — the rail button it focuses is removed by
 * this very transition, which is how a keyboard user used to land on `<body>`.
 */
function regionInheritingFocus(next: LayoutMode): 'layers' | 'inspector' | null {
	if (layoutMode.value !== 'constrained' || next !== 'full' || overlay.value === 'none') return null;
	return overlay.value;
}

/**
 * `root` is cast rather than optional-chained at both call sites: it names this component's own
 * outermost element, which is bound before `onMounted` runs and stays bound for as long as the
 * observer can fire, so a null branch here would be one nothing could ever take.
 *
 * The focus move waits for `nextTick` because the region it targets does not exist yet: the
 * persistent panels are what the `full` branch renders, and Vue's re-render is asynchronous, so
 * at the moment `setLayoutMode` returns the DOM still holds the overlay this call just closed.
 */
function measure(): void {
	const next = layoutModeFor((root.value as HTMLElement).clientWidth);
	const region = regionInheritingFocus(next);
	workspace.setLayoutMode(next);
	if (region === null) return;
	void nextTick(() => {
		const aside = (root.value as HTMLElement).querySelector(`[data-rp-region="${region}"]`);
		(aside as HTMLElement).focus();
	});
}

/**
 * Which rail button each overlay belongs to. A TABLE rather than a conditional, because the two
 * vocabularies differ on purpose — the rail says `details` where the store says `inspector` —
 * and one mapping written down is what keeps the focus return from being a second opinion about
 * that.
 */
const RAIL_BUTTON: Record<'layers' | 'inspector', string> = { layers: 'layers', inspector: 'details' };

/**
 * Close the overlay and put focus back on the button that opened it (§5.5).
 *
 * The button is queried rather than remembered, and it is always there: this function is bound
 * only to the overlay's and the drawer's own `close` events, which can only be emitted while
 * one of them is rendered — which happens only in `constrained`, which is exactly when the rail
 * is rendered too. Vue's re-render is asynchronous, so the rail is still in the DOM at the
 * moment this runs even though the store has already been told the overlay is closed. Both
 * casts state that guarantee the way `AddMenu.focusEntry`'s does, instead of a `?.` whose other
 * arm no test could reach.
 */
function closeOverlay(kind: 'layers' | 'inspector'): void {
	workspace.closeOverlay();
	const button = (root.value as HTMLElement).querySelector(`[data-rp-rail="${RAIL_BUTTON[kind]}"]`);
	(button as HTMLElement).focus();
}

onMounted(() => {
	measure();
	observer = new ResizeObserver(measure);
	observer.observe(root.value as HTMLElement);
});

// A leaf can be closed with the editor mounted, and an observer outlives the element it
// watches: without this, every closed Plan Editor leaves one behind holding this component's
// whole closure.
onBeforeUnmount(() => observer.disconnect());
</script>

<template>
	<div
		ref="root"
		class="rp-editor-shell"
		:data-layout="layoutMode"
	>
		<slot name="context-bar" />
		<div class="rp-editor-body">
			<slot
				v-if="layoutMode === 'full'"
				name="panel"
			/>
			<PanelRail v-if="layoutMode === 'constrained'" />
			<slot
				v-if="layoutMode !== 'unsupported'"
				name="canvas"
			/>
			<slot
				v-if="layoutMode === 'full'"
				name="inspector"
			/>
			<OverlayPanel
				v-if="layoutMode === 'constrained' && overlay === 'layers'"
				@close="closeOverlay('layers')"
			>
				<slot name="panel" />
			</OverlayPanel>
			<InspectorDrawer
				v-if="layoutMode === 'constrained' && overlay === 'inspector'"
				@close="closeOverlay('inspector')"
			>
				<slot name="inspector" />
			</InspectorDrawer>
			<UnsupportedWidthNotice v-if="layoutMode === 'unsupported'" />
		</div>
		<slot name="warnings" />
		<slot name="status" />
	</div>
</template>
