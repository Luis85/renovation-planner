<script setup lang="ts">
/**
 * One mounted outlet per region. Columns become modeless overlays through CSS, without
 * replacing native controls or committing their pending text through an incidental blur.
 * The canvas alone unmounts below the supported width, releasing its pointer gesture.
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { layoutModeFor, type LayoutMode } from './layoutMode';
import InspectorDrawer from './InspectorDrawer.vue';
import OverlayPanel from './OverlayPanel.vue';
import PanelRail from './PanelRail.vue';
import UnsupportedWidthNotice from './UnsupportedWidthNotice.vue';

type Region = 'layers' | 'inspector';
const RAIL_BUTTON: Record<Region, string> = { layers: 'layers', inspector: 'details' };
const workspace = useWorkspaceStore();
const { layoutMode, overlay } = storeToRefs(workspace);
const root = ref<HTMLElement | null>(null);
let observer!: ResizeObserver;
let measurement = 0;

function focusedRegion(active: Element): Region | null {
	const container = active.closest<HTMLElement>('[data-rp-shell-region]');
	if (container) return container.dataset.rpShellRegion as Region;
	const rail = active.getAttribute('data-rp-rail');
	if (rail === 'layers') return 'layers';
	return rail === 'details' ? 'inspector' : null;
}

/** A surviving input keeps focus. Only disappearing chrome needs a replacement target. */
function restoreFocus(active: Element, region: Region | null, next: LayoutMode, version: number): void {
	if (!root.value || measurement !== version) return;
	const current = root.value.ownerDocument.activeElement;
	if (current !== active && current !== root.value.ownerDocument.body) return;
	const selector = next === 'unsupported' ? '.rp-unsupported-width__action' : region === null
		? '.rp-plan-canvas' : `[data-rp-region="${region}"]`;
	const target = root.value.querySelector<HTMLElement>(selector);
	if (target && !target.contains(active)) target.focus();
}

function measure(): void {
	const element = root.value as HTMLElement;
	const next = layoutModeFor(element.clientWidth);
	if (next === layoutMode.value) return;
	const active = element.ownerDocument.activeElement as Element;
	const inside = element.querySelector('.rp-editor-body')?.contains(active);
	const region = inside ? focusedRegion(active) : null;
	const version = ++measurement;
	workspace.setLayoutMode(next);
	// Reveal before Vue patches visibility, so the focused field is never hidden on shrink.
	if (next === 'constrained' && region !== null) workspace.openOverlay(region);
	if (inside) void nextTick(() => restoreFocus(active, region, next, version));
}

/** Explicit rail/task opening takes focus unless the region already owns the keyboard. */
watch([layoutMode, overlay], () => {
	if (layoutMode.value !== 'constrained' || overlay.value === 'none') return;
	const container = (root.value as HTMLElement).querySelector<HTMLElement>(`[data-rp-shell-region="${overlay.value}"]`) as HTMLElement;
	if (!container.contains(container.ownerDocument.activeElement)) container.focus();
}, { flush: 'post' });

function closeOverlay(kind: Region): void {
	workspace.closeOverlay();
	const button = (root.value as HTMLElement).querySelector<HTMLElement>(`[data-rp-rail="${RAIL_BUTTON[kind]}"]`) as HTMLElement;
	// Synchronous focus return delivers blur before the region is hidden.
	button.focus();
}

function escapeOverlay(event: KeyboardEvent, kind: Region): void {
	if (layoutMode.value !== 'constrained') return;
	event.stopPropagation();
	closeOverlay(kind);
}

onMounted(() => {
	measure();
	observer = new ResizeObserver(measure);
	observer.observe(root.value as HTMLElement);
});
onBeforeUnmount(() => observer.disconnect());
</script>

<template>
	<div
		ref="root"
		class="rp-editor-shell"
		:data-layout="layoutMode"
	>
		<slot name="context-bar" />
		<slot name="warnings" />
		<div class="rp-editor-body">
			<OverlayPanel
				v-show="layoutMode === 'full' || (layoutMode === 'constrained' && overlay === 'layers')"
				:floating="layoutMode === 'constrained' && overlay === 'layers'"
				data-rp-shell-region="layers"
				@close="closeOverlay('layers')"
				@keydown.esc="escapeOverlay($event, 'layers')"
			>
				<slot name="panel" />
			</OverlayPanel>
			<PanelRail v-if="layoutMode === 'constrained'" />
			<slot
				v-if="layoutMode !== 'unsupported'"
				name="canvas"
			/>
			<InspectorDrawer
				v-show="layoutMode === 'full' || (layoutMode === 'constrained' && overlay === 'inspector')"
				:floating="layoutMode === 'constrained' && overlay === 'inspector'"
				data-rp-shell-region="inspector"
				@close="closeOverlay('inspector')"
				@keydown.esc="escapeOverlay($event, 'inspector')"
			>
				<slot name="inspector" />
			</InspectorDrawer>
			<UnsupportedWidthNotice v-if="layoutMode === 'unsupported'" />
		</div>
		<slot name="status" />
	</div>
</template>
