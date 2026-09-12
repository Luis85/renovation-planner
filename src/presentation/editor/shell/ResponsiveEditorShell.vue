<script setup lang="ts">
/**
 * One mounted outlet per region. In the full layout each side panel resizes and collapses
 * (EditorSidePanel, 2026-09-12); constrained columns become modeless overlays through CSS,
 * without replacing native controls or committing pending text through an incidental blur.
 * The canvas alone unmounts below the supported width, releasing its pointer gesture.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { layoutModeFor, type LayoutMode } from './layoutMode';
import EditorSidePanel from './EditorSidePanel.vue';
import { usePlanEditorContext } from '../PlanEditorContext';
import { PANEL_BOUNDS, effectivePanelWidths, maxPanelWidth, parsePanelLayout, type PanelSide } from './panelLayout';
import PanelRail from './PanelRail.vue';
import UnsupportedWidthNotice from './UnsupportedWidthNotice.vue';

type Region = 'layers' | 'inspector';
const RAIL_BUTTON: Record<Region, string> = { layers: 'layers', inspector: 'details' };
const workspace = useWorkspaceStore();
const context = usePlanEditorContext();
const { layoutMode, overlay, panelLayout } = storeToRefs(workspace);
const shellWidth = ref(0);
// Restored once, before the first render, so a leaf never draws the defaults for a frame first.
workspace.restorePanelLayout(parsePanelLayout(context.panelLayout.read()));
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

/**
 * Where focus goes when a layout change hides what had it. A panel collapsed in the full layout
 * hides its whole region — the focused control with it — so its strip stands in for the region,
 * the same way a collapse hands focus to the strip.
 */
function focusTarget(region: Region | null, next: LayoutMode): string {
	if (next === 'unsupported') return '.rp-unsupported-width__action';
	if (region === null) return '.rp-plan-canvas';
	return next === 'full' && panelLayout.value[region].collapsed
		? `[data-rp-strip="${region}"] [data-rp-panel-toggle]`
		: `[data-rp-region="${region}"]`;
}

/** A surviving input keeps focus. Only disappearing chrome needs a replacement target. */
function restoreFocus(active: Element, region: Region | null, next: LayoutMode, version: number): void {
	if (!root.value || measurement !== version) return;
	const current = root.value.ownerDocument.activeElement;
	if (current !== active && current !== root.value.ownerDocument.body) return;
	const target = root.value.querySelector<HTMLElement>(focusTarget(region, next));
	if (target && !target.contains(active)) target.focus();
}

function measure(): void {
	const element = root.value as HTMLElement;
	shellWidth.value = element.clientWidth;
	const next = layoutModeFor(shellWidth.value);
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

/** What each panel is drawn at — `panelLayout.ts` keeps the canvas floor without touching the stored widths. */
const widths = computed(() => effectivePanelWidths(panelLayout.value, shellWidth.value));
const bodyStyle = computed(() => ({
	'--rp-layers-width': `${widths.value.layers}px`,
	'--rp-inspector-width': `${widths.value.inspector}px`,
}));

/** Every binding a side panel takes, in one place so the template stays flat. */
function panelProps(side: PanelSide): { side: PanelSide; full: boolean; floating: boolean; collapsed: boolean; width: number; min: number; max: number } {
	return {
		side,
		full: layoutMode.value === 'full',
		floating: layoutMode.value === 'constrained' && overlay.value === side,
		collapsed: panelLayout.value[side].collapsed,
		width: widths.value[side],
		min: PANEL_BOUNDS[side].min,
		max: maxPanelWidth(side, panelLayout.value, shellWidth.value),
	};
}

function persist(): void {
	context.panelLayout.write(panelLayout.value);
}

function togglePanel(side: PanelSide): void {
	workspace.setPanel(side, { collapsed: !panelLayout.value[side].collapsed });
	persist();
}

function resetPanel(side: PanelSide): void {
	workspace.setPanel(side, { width: PANEL_BOUNDS[side].initial });
	persist();
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
		<div
			class="rp-editor-body"
			:style="bodyStyle"
		>
			<EditorSidePanel
				v-show="layoutMode === 'full' || (layoutMode === 'constrained' && overlay === 'layers')"
				v-bind="panelProps('layers')"
				data-rp-shell-region="layers"
				@close="closeOverlay('layers')"
				@keydown.esc="escapeOverlay($event, 'layers')"
				@toggle="togglePanel('layers')"
				@resize="workspace.setPanel('layers', { width: $event })"
				@commit="persist"
				@reset="resetPanel('layers')"
			>
				<slot name="panel" />
			</EditorSidePanel>
			<PanelRail v-if="layoutMode === 'constrained'" />
			<slot
				v-if="layoutMode !== 'unsupported'"
				name="canvas"
			/>
			<EditorSidePanel
				v-show="layoutMode === 'full' || (layoutMode === 'constrained' && overlay === 'inspector')"
				v-bind="panelProps('inspector')"
				data-rp-shell-region="inspector"
				@close="closeOverlay('inspector')"
				@keydown.esc="escapeOverlay($event, 'inspector')"
				@toggle="togglePanel('inspector')"
				@resize="workspace.setPanel('inspector', { width: $event })"
				@commit="persist"
				@reset="resetPanel('inspector')"
			>
				<slot name="inspector" />
			</EditorSidePanel>
			<UnsupportedWidthNotice v-if="layoutMode === 'unsupported'" />
		</div>
		<slot name="status" />
	</div>
</template>
