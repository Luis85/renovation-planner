<script setup lang="ts">
/**
 * A selected door, window or opening's own handles: two width grips, a move grip, two step
 * arrows and, for a door or window, two side chevrons — every mark `selectedOpeningHandles`
 * answers, at the identical points `SelectTool` hit-tests through `openingHandleDoors`, so a
 * press lands on the mark the user aimed at rather than near it.
 *
 * Like every mark on the `InteractionLayer`, this draws in STAGE PIXELS and is
 * `listening: false` — the layer hears no pointer events, and `SelectTool` does its own
 * geometry hit test against the same `selectedOpeningHandles` call. Drawn only in the Plan
 * perspective's Select tool, which is a gate `selectedOpeningHandles` itself does not take:
 * it answers purely from the selection and the structure.
 */
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import type { ThemeTokens } from '../theme/themeTokens';
import { STAGE_PIXELS, worldPerScreenPixel, worldToScreen } from '../viewport/Viewport';
import { OPENING_HANDLE_RADIUS_PX } from '../handleMetrics';
import { selectedOpeningHandles, type OpeningGrip, type OpeningHandle } from './openingHandles';

const props = defineProps<{ tokens: ThemeTokens }>();
const runtime = useEditorRuntime(), editor = useEditorStore(), project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession();

/** The two step arrows draw as solid dots; every other circle grip draws as a ring around them. */
const STEP_GRIPS: readonly OpeningGrip[] = ['step-back', 'step-forward'];
/** How far a chevron's two wings sit behind its tip, and how far apart they spread — stage pixels, like every other size on this layer. */
const CHEVRON_LENGTH_PX = 8, CHEVRON_SPREAD_PX = 5;

const drawn = computed(() => {
	if (session.perspective !== 'plan' || runtime.activeToolId.value !== 'select') return null;
	const worldPerPixel = worldPerScreenPixel(editor.viewport, STAGE_PIXELS);
	const resolved = selectedOpeningHandles(project.structure, selection.selectedIds, worldPerPixel);
	if (resolved === null) return null;
	const toScreen = (point: { x: number; y: number }) => worldToScreen(point, editor.viewport, STAGE_PIXELS);

	const circles = resolved.handles
		.filter(handle => handle.grip !== 'side-left' && handle.grip !== 'side-right')
		.map(handle => {
			const at = toScreen(handle.point), step = STEP_GRIPS.includes(handle.grip);
			return {
				grip: handle.grip, x: at.x, y: at.y,
				fill: step ? props.tokens.accent : props.tokens.canvasBackground,
				stroke: step ? props.tokens.canvasBackground : props.tokens.accent,
			};
		});

	// The chevrons orient off the MOVE grip's own screen point rather than the host wall: the
	// vector from it to a chevron's point already carries the outward face direction — the same
	// one `openingHandles`' own `chevrons()` derives from the host — so drawing needs nothing
	// beyond the points `selectedOpeningHandles` already answered.
	//
	// `move` is a CAST, not a checked branch: `openingHandles`' own `marks` never drops the move
	// grip, even at the crowding floor, so whenever `resolved.handles` holds anything at all it
	// holds a 'move' entry — a guard here would be a branch coverage could never exercise
	// (CLAUDE.md, "an unreachable guard is not free").
	const move = toScreen((resolved.handles.find(handle => handle.grip === 'move') as OpeningHandle).point);
	const chevrons = resolved.handles
		.filter(handle => handle.grip === 'side-left' || handle.grip === 'side-right')
		.map(handle => {
			const tip = toScreen(handle.point);
			// Likewise unguarded: `OPENING_CHEVRON_GAP_PX` is a fixed positive constant, so a
			// chevron point can never coincide with the move point and `length` is never zero.
			const dx = tip.x - move.x, dy = tip.y - move.y, length = Math.hypot(dx, dy);
			const normal = { x: dx / length, y: dy / length }, tangent = { x: -normal.y, y: normal.x };
			const wing = (sign: number) => ({
				x: tip.x - normal.x * CHEVRON_LENGTH_PX + tangent.x * sign * CHEVRON_SPREAD_PX,
				y: tip.y - normal.y * CHEVRON_LENGTH_PX + tangent.y * sign * CHEVRON_SPREAD_PX,
			});
			return { grip: handle.grip, points: [wing(1), tip, wing(-1)].flatMap(point => [point.x, point.y]) };
		});

	return { circles, chevrons };
});
</script>

<template>
	<VGroup
		v-if="drawn"
		:config="{ name: 'opening-handles', listening: false }"
	>
		<VCircle
			v-for="circle in drawn.circles"
			:key="circle.grip"
			:config="{
				name: `opening-handle-${circle.grip}`,
				x: circle.x, y: circle.y,
				radius: OPENING_HANDLE_RADIUS_PX,
				fill: circle.fill,
				stroke: circle.stroke,
				strokeWidth: 1.5,
				listening: false,
			}"
		/>
		<VLine
			v-for="chevron in drawn.chevrons"
			:key="chevron.grip"
			:config="{
				name: 'opening-chevron',
				points: chevron.points,
				stroke: props.tokens.accent,
				strokeWidth: 2,
				lineCap: 'round',
				lineJoin: 'round',
				listening: false,
			}"
		/>
	</VGroup>
</template>
