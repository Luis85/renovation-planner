<script setup lang="ts">
/**
 * §60's `Status / Measurements / Save State` bar, keeping those three named regions rather
 * than inventing a different split — slice 13 mounts its save-state indicator into the
 * third of them BY NAME, and a bar with two regions or four would leave it nowhere to go.
 *
 * The measurements readout is read-only telemetry: the pointer's position in world
 * millimetres, and the zoom. It demonstrates the viewport transform working end to end
 * without any editable state behind it — `screenToWorld` on the last known pointer
 * position, computed in `EditorStore` so no component does its own pixel arithmetic.
 *
 * Save state renders `SaveStateIndicator` now, which is slice 13's whole contribution here:
 * this component still owns the region's `role="status"` and `aria-label`, and the indicator
 * mounts INSIDE that one live region rather than declaring a second one of its own — a nested
 * live region would announce the same change twice.
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import type { ToolId } from '../tools/editor-tool';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
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

/**
 * The tools that take the Shift angle constraint, and therefore the ones whose hint is worth
 * showing. A list rather than "any tool": Select constrains nothing, and camera mode has no
 * tool at all, so announcing it there would be advertising a key that does nothing.
 *
 * It is the one place the constraint is mentioned to the user at all. A modifier is invisible
 * — no control shows it, no menu lists it — which is the standing cost of the convention every
 * drawing tool in the field uses, and this is the cheapest honest mitigation: present while
 * the gesture it applies to is available, gone the moment it is not.
 */
const CONSTRAINING_TOOLS: readonly ToolId[] = ['draw-polygon', 'calibrate'];

const showsConstraintHint = computed(() => {
	const active = props.activeToolId ?? null;
	return active !== null && CONSTRAINING_TOOLS.includes(active);
});

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
		</div>
		<div
			class="rp-editor-measurements"
			role="group"
			:aria-label="tr('editor.measurements')"
		>
			<span>{{ tr('editor.zoom') }} {{ zoomPercent }}</span>
			<span>{{ pointerText }}</span>
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
