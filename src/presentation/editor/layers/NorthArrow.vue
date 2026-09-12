<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PlanId } from '../../../domain/plan/PlanId';
import { tr } from '../../i18n/strings';
import { notifyFault, notifyOperationFailure } from '../../notices/notify';
import { useProjectStore } from '../../stores/ProjectStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useRenovationSession } from '../renovation/renovationSession';
import { useEditorRuntime } from '../runtime';

/**
 * The plan's north arrow, pinned to the canvas corner rather than drawn in the scene: a bearing
 * is a property of the plan, not a position on it. Dragging or an arrow key turns it in STEP
 * degrees; the preview is local and ONE command is dispatched per release, so one undo step.
 */
const STEP = 15;
const KEY_TURNS: Readonly<Record<string, number>> = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP };
const project = useProjectStore(), workspace = useWorkspaceStore(), session = useRenovationSession();
const context = usePlanEditorContext(), runtime = useEditorRuntime();
const draft = ref<number | null>(null);
const saved = computed(() => project.plan?.north ?? 0);
const bearing = computed(() => draft.value ?? saved.value);
/** The write, while one is allowed: an absent service, blocked writes and review all draw a still arrow. */
const service = computed(() => (runtime.writesBlocked.value || session.perspective === 'review' ? null : context.commands.planNorth ?? null));

function snapped(degrees: number): number {
	return (((Math.round(degrees / STEP) * STEP) % 360) + 360) % 360;
}
function pointed(event: PointerEvent): number {
	const box = (event.currentTarget as Element).getBoundingClientRect();
	return snapped((Math.atan2(event.clientX - box.left - box.width / 2, box.top + box.height / 2 - event.clientY) * 180) / Math.PI);
}
function press(event: PointerEvent): void {
	if (service.value === null) return;
	(event.currentTarget as Element).setPointerCapture?.(event.pointerId);
	draft.value = pointed(event);
}
function drag(event: PointerEvent): void {
	if (draft.value !== null) draft.value = pointed(event);
}
function release(): void {
	if (draft.value !== null) void commit(draft.value);
}
function key(event: KeyboardEvent): void {
	const turn = KEY_TURNS[event.key] as number | undefined;
	if (turn === undefined || service.value === null) return;
	event.preventDefault();
	void commit(snapped(bearing.value + turn));
}
async function commit(north: number): Promise<void> {
	const planNorth = service.value;
	if (planNorth === null || north === saved.value) { draft.value = null; return; }
	draft.value = north;
	try {
		const result = await runtime.dispatcher.run(planNorth.command(context.planId as PlanId, north));
		if (!result.ok) notifyOperationFailure(result.error);
	} catch (cause) { notifyFault(cause, context.commands.logger, 'editor.north.failed'); }
	finally { draft.value = null; }
}
</script>

<template>
	<svg
		v-if="workspace.northVisible"
		class="rp-north-arrow"
		viewBox="-60 -60 120 120"
		role="slider"
		tabindex="0"
		aria-valuemin="0"
		aria-valuemax="359"
		:aria-label="tr('editor.north')"
		:aria-valuenow="bearing"
		:aria-valuetext="tr('editor.north.value', { degrees: String(bearing) })"
		:aria-disabled="service === null"
		@pointerdown="press"
		@pointermove.stop="drag"
		@pointerup="release"
		@pointercancel="draft = null"
		@keydown="key"
	>
		<circle
			class="rp-north-arrow__dial"
			r="34"
		/>
		<path d="M24 -24 L30 -30 M24 24 L30 30 M-24 24 L-30 30 M-24 -24 L-30 -30" />
		<g :transform="`rotate(${bearing})`">
			<path
				class="rp-north-arrow__needle"
				d="M0 -44 L9 30 L0 20 L-9 30 Z M0 -44 L0 20"
			/>
			<text y="-47">{{ tr('editor.north.letter') }}</text>
		</g>
		<circle
			class="rp-north-arrow__pivot"
			r="2"
		/>
	</svg>
</template>
