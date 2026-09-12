<script setup lang="ts">
/**
 * A full-layout side panel's inner edge (2026-09-12 side panels spec §1): the WAI-ARIA window
 * splitter pattern. It owns the gesture and the keys and nothing else — the width lives in
 * `WorkspaceStore`, the shell hands over its `PanelRange` (`panelLayout.ts`), and a `commit` is the
 * one moment anything is persisted. A drag reports every move and commits once on release, so
 * storage is never written per pointer move.
 *
 * Keys and drags move the STORED width inside `range.min`/`range.max`; the ARIA values are the
 * range's drawn ones. Keeping those two apart is what lets a panel the canvas floor has shrunk
 * announce the width it is drawn at without a grow gesture starting from that smaller figure.
 */
import { tr } from '../../i18n/strings';
import { PANEL_COPY } from './panelSections';
import type { PanelRange, PanelSide } from './panelLayout';

const props = defineProps<{ side: PanelSide; range: PanelRange; controls: string }>();
const emit = defineEmits<{ resize: [width: number]; commit: []; reset: []; collapse: [] }>();

const STEP = 16;
const BIG_STEP = 64;
let drag: { readonly pointerId: number; readonly startX: number; readonly startWidth: number } | null = null;

/** The Inspector grows as its LEFT edge moves left, so its horizontal deltas are mirrored. */
function signed(delta: number): number {
	return props.side === 'layers' ? delta : -delta;
}

function clamp(width: number, max = props.range.max): number {
	return Math.min(max, Math.max(props.range.min, width));
}

function onPointerDown(event: PointerEvent): void {
	if (event.button !== 0) return;
	event.preventDefault();
	(event.currentTarget as Element).setPointerCapture?.(event.pointerId);
	drag = { pointerId: event.pointerId, startX: event.clientX, startWidth: props.range.width };
}

/**
 * `range.max` follows the stored width while a shrunk panel is dragged narrower, so the ceiling
 * also admits the width the drag started from: dragging back returns to it.
 */
function onPointerMove(event: PointerEvent): void {
	if (drag?.pointerId !== event.pointerId) return;
	emit('resize', clamp(drag.startWidth + signed(event.clientX - drag.startX), Math.max(props.range.max, drag.startWidth)));
}

function onPointerEnd(event: PointerEvent): void {
	if (drag?.pointerId !== event.pointerId) return;
	drag = null;
	emit('commit');
}

function keyWidth(event: KeyboardEvent): number | null {
	const step = event.shiftKey ? BIG_STEP : STEP;
	if (event.key === 'ArrowRight') return props.range.width + signed(step);
	if (event.key === 'ArrowLeft') return props.range.width - signed(step);
	if (event.key === 'Home') return props.range.min;
	if (event.key === 'End') return props.range.max;
	return null;
}

function onKeydown(event: KeyboardEvent): void {
	if (event.key === 'Enter') {
		event.preventDefault();
		emit('collapse');
		return;
	}
	const next = keyWidth(event);
	if (next === null) return;
	event.preventDefault();
	emit('resize', clamp(next));
	emit('commit');
}
</script>

<template>
	<div
		class="rp-side-panel__resizer"
		role="separator"
		tabindex="0"
		aria-orientation="vertical"
		:aria-controls="controls"
		:aria-label="tr(PANEL_COPY[side].resize)"
		:aria-valuenow="range.valueNow"
		:aria-valuemin="range.valueMin"
		:aria-valuemax="range.valueMax"
		:data-rp-resizer="side"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="onPointerEnd"
		@pointercancel="onPointerEnd"
		@keydown="onKeydown"
		@dblclick="emit('reset')"
	/>
</template>
