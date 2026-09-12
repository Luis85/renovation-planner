<script setup lang="ts">
/**
 * One side panel — Property and layers, or the Inspector — in both layouts the shell draws panels
 * in (2026-09-12 side panels spec §1). It replaces `OverlayPanel` and `InspectorDrawer`, which were
 * the same component twice.
 *
 * FULL: a header with the collapse button, the panel content, and `PanelResizer` on the inner edge;
 * collapsed, `PanelCollapsedStrip`. CONSTRAINED: M16's overlay or drawer exactly as before — its
 * class names, close button and `tabindex="-1"` are what `responsiveShell.test.ts` and
 * `persistentRegions.test.ts` pin.
 *
 * The slot is `v-show`n and never unmounted, for the reason the two replaced components gave: a
 * native input keeps its identity, and a pending field edit is not committed by a blur the user
 * did not make. Every state change is EMITTED; the shell owns the store and storage.
 *
 * `root.value` and the other refs are CAST rather than optional-chained: each names an element
 * this component draws for as long as the handler that reads it can run.
 */
import { nextTick, ref, useId } from 'vue';
import { tr } from '../../i18n/strings';
import HostIcon from '../../components/HostIcon.vue';
import PanelResizer from './PanelResizer.vue';
import PanelCollapsedStrip from './PanelCollapsedStrip.vue';
import { PANEL_COPY } from './panelSections';
import type { PanelRange, PanelSide } from './panelLayout';

defineProps<{
	side: PanelSide;
	/** The shell is in its full layout, where the header, handle and strip exist at all. */
	full: boolean;
	/** The shell is constrained and this panel is its open overlay — never true alongside `full`. */
	floating: boolean;
	collapsed: boolean;
	range: PanelRange;
}>();
const emit = defineEmits<{ close: []; toggle: []; resize: [width: number]; commit: []; reset: [] }>();

const bodyId = useId();
const root = ref<HTMLElement | null>(null);
const collapseButton = ref<HTMLButtonElement | null>(null);
const strip = ref<InstanceType<typeof PanelCollapsedStrip> | null>(null);

const OVERLAY_CLASS: Readonly<Record<PanelSide, string>> = { layers: 'rp-overlay-panel', inspector: 'rp-inspector-drawer' };

/** Collapsing removes the control that had focus, so focus follows to the strip — only if it was ours. */
async function collapse(): Promise<void> {
	const element = root.value as HTMLElement;
	const owned = element.contains(element.ownerDocument.activeElement);
	emit('toggle');
	await nextTick();
	if (owned) (strip.value as InstanceType<typeof PanelCollapsedStrip>).focusExpand();
}

/** Expanding lands on the section the strip named, opened, or on the header's collapse button. */
async function expand(section: string | null): Promise<void> {
	emit('toggle');
	await nextTick();
	const details = section === null ? null : (root.value as HTMLElement).querySelector<HTMLDetailsElement>(`[data-rp-section="${section}"]`);
	if (details === null) {
		(collapseButton.value as HTMLButtonElement).focus();
		return;
	}
	details.open = true;
	(details.querySelector('summary') as HTMLElement).focus();
}
</script>

<template>
	<div
		ref="root"
		:class="floating
			? OVERLAY_CLASS[side]
			: ['rp-persistent-panel', 'rp-side-panel', `rp-side-panel--${side}`, { 'rp-side-panel--collapsed': full && collapsed }]"
		:tabindex="floating ? -1 : undefined"
	>
		<button
			v-if="floating"
			type="button"
			:class="`${OVERLAY_CLASS[side]}__close`"
			@click="emit('close')"
		>
			{{ tr('editor.overlay.close') }}
		</button>
		<div
			v-if="full"
			v-show="!collapsed"
			class="rp-side-panel__header"
		>
			<span class="rp-side-panel__title">{{ tr(PANEL_COPY[side].title) }}</span>
			<button
				ref="collapseButton"
				type="button"
				class="rp-side-panel__toggle"
				:data-rp-panel-toggle="side"
				aria-expanded="true"
				:aria-controls="bodyId"
				:aria-label="tr(PANEL_COPY[side].collapse)"
				:title="tr(PANEL_COPY[side].collapse)"
				@click="collapse"
			>
				<HostIcon :name="side === 'layers' ? 'chevron-left' : 'chevron-right'" />
			</button>
		</div>
		<div
			v-show="!(full && collapsed)"
			:id="bodyId"
			class="rp-side-panel__body"
		>
			<slot />
		</div>
		<PanelResizer
			v-if="full"
			v-show="!collapsed"
			:side="side"
			:range="range"
			:controls="bodyId"
			@resize="emit('resize', $event)"
			@commit="emit('commit')"
			@reset="emit('reset')"
			@collapse="collapse"
		/>
		<PanelCollapsedStrip
			v-if="full && collapsed"
			ref="strip"
			:side="side"
			:controls="bodyId"
			@expand="expand"
		/>
	</div>
</template>
