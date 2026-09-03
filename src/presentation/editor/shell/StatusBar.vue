<script setup lang="ts">
/**
 * §60's `Status / Measurements / Save State` bar, keeping those three named regions rather
 * than inventing a different split — slice 13 mounts its save-state indicator into the
 * third of them BY NAME, and a bar with two regions or four would leave it nowhere to go.
 *
 * The measurements readout is read-only telemetry: whether the plan's scale is set, the
 * pointer's position in world millimetres, and the zoom. It demonstrates the viewport
 * transform working end to end without any editable state behind it — `screenToWorld` on
 * the last known pointer position, computed in `EditorStore` so no component does its own
 * pixel arithmetic.
 *
 * Save state renders `SaveStateIndicator` now, which is slice 13's whole contribution here:
 * this component still owns the region's `role="status"` and `aria-label`, and the indicator
 * mounts INSIDE that one live region rather than declaring a second one of its own — a nested
 * live region would announce the same change twice.
 *
 * **Task 20 added the scale state, a pan-override reminder, and the pointer readout's
 * withdrawal under M16's constrained layout.** The pointer readout is the one region that
 * shrinks the pane rather than merely narrowing — a coordinate pair beside a percentage beside
 * a save-state word does not fit a 460px sidebar leaf — so `layoutMode` (`WorkspaceStore`)
 * hides it there while the zoom, the scale and save state all stay: none of those three
 * grows with the pane's width the way a live coordinate readout effectively does.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import type { ToolId } from '../tools/editor-tool';
import { constrainsAngle } from '../snapping/editorSnapping';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import SaveStateIndicator from '../save-state/SaveStateIndicator.vue';

/**
 * The active tool, from the PARENT rather than from `useEditorRuntime()`.
 *
 * A prop because this component is mounted STANDALONE by the harness index, which draws every
 * real component against the shared fixture with no per-entry setup — injecting the runtime
 * made it throw there, and a shell region that can only be looked at inside the whole editor
 * is one nobody looks at. Optional for the same reason: the index passes nothing.
 */
const props = defineProps<{ activeToolId?: ToolId | null }>();

const { plan } = storeToRefs(useProjectStore());
const { viewport, pointerWorld } = storeToRefs(useEditorStore());
const { layoutMode } = storeToRefs(useWorkspaceStore());

/**
 * Whether the active tool takes the Shift angle constraint, asked of the ONE list that holds
 * that question (`snapping/editorSnapping.ts`).
 *
 * The list used to live here, naming this surface's two tools. Design slice B5 gave the asset
 * designer a status region owing the identical hint about three tools of its own, and two
 * lists would be two answers to "does this tool constrain" — a tool that grows the constraint
 * would be advertised in whichever list its author happened to open. The ids of the two
 * surfaces are disjoint and each status bar asks about its own manager's active tool, so one
 * list can never make this bar advertise a tool the Plan Editor cannot activate.
 */
const showsConstraintHint = computed(() => constrainsAngle(props.activeToolId ?? null));

/**
 * Task 20: whether `PlanDto.calibration` is set — a fact plain enough to state as one of
 * two fixed sentences rather than as a number, since the scale ITSELF (what one background
 * pixel is worth in world millimetres) is not something a homeowner reads usefully off a
 * status bar.
 */
const scaleText = computed(() =>
	tr(plan.value?.calibration ? 'editor.status.scale.calibrated' : 'editor.status.scale.uncalibrated'),
);

/**
 * Task 20's pan-override reminder, under the same "a modifier nothing mentions is a feature
 * only its author knows about" argument as the angle-constraint hint above. Select is the
 * one tool it applies to: camera mode already owns the pointer and needs no reminder about
 * itself, and every creation/calibration tool's own task banner already occupies the canvas
 * with its own instruction.
 */
const showsPanHint = computed(() => props.activeToolId === 'select');

const zoomPercent = computed(() => `${Math.round(viewport.value.zoom * 100)}%`);

/**
 * Whole millimetres. A tenth of a millimetre is below what a pointer can resolve at any
 * usable zoom, and a readout that jitters in its last digit is one people stop reading.
 */
const pointerText = computed(() => {
	const at = pointerWorld.value;
	return at === null ? '—' : `${Math.round(at.x)}, ${Math.round(at.y)} mm`;
});
</script>

<template>
	<!--
		Each region carries a ROLE beside its `aria-label`, because `aria-label` on a plain
		`<div>` is prohibited — axe's `aria-prohibited-attr`, and it caught all three of these
		the first time `tests/harness/accessibility.test.ts` was pointed at this component.
		`group` for the two that are read on request; `status` for the save state, which is
		the one region whose whole job is to announce a change. The
		measurements deliberately are NOT a live region: it updates on every pointer move,
		and a screen reader reciting coordinates continuously is worse than silence.
	-->
	<footer class="rp-editor-status-bar">
		<div
			class="rp-editor-status"
			role="group"
			:aria-label="tr('editor.status')"
		>
			<span class="rp-editor-plan-name">{{ plan?.name ?? '' }}</span>
			<span
				v-if="showsConstraintHint"
				class="rp-editor-hint"
			>{{ tr('editor.hint.constrain-angle') }}</span>
			<span
				v-if="showsPanHint"
				class="rp-editor-pan-hint"
			>{{ tr('editor.hint.pan') }}</span>
		</div>
		<div
			class="rp-editor-measurements"
			role="group"
			:aria-label="tr('editor.measurements')"
		>
			<span class="rp-editor-scale">{{ scaleText }}</span>
			<span>{{ tr('editor.zoom') }} {{ zoomPercent }}</span>
			<span
				v-if="layoutMode !== 'constrained'"
				class="rp-editor-pointer"
			>{{ pointerText }}</span>
		</div>
		<div
			class="rp-editor-save-state"
			role="status"
			:aria-label="tr('editor.save-state')"
		>
			<SaveStateIndicator />
		</div>
	</footer>
</template>
