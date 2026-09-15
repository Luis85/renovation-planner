<script setup lang="ts">
/**
 * The shell's one `role="status"` region that announces "select something" exactly once when
 * a selection clears to nothing (design spec §6.6) — cleared shortly after so a refresh or an
 * idle pointer move over the canvas never re-announces it.
 *
 * **R15 (2026-09-04): mounted by `PlanEditorRoot` in the warnings region, beside
 * `PersistentWarningStrip`, rather than inside `EntityInspector`.** [[Selection clearing is
 * silent while the constrained Inspector is closed]] is why: `ResponsiveEditorShell` mounts
 * `EntityInspector` in `constrained` layout only while its drawer is open, so a watcher living
 * there hears nothing while the drawer is closed — a selection cleared from the canvas in that
 * state announced silently. A watcher that is not mounted hears nothing; this component is
 * mounted in every supported layout, so it always is. `EntityInspector` keeps only visible
 * Inspector content now.
 */
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { useSelectionStore } from '../selection/selection-store';
import { useProjectStore } from '../../stores/ProjectStore';
import { structureRecords } from '../structure/structureRecords';

const { selectedIds } = storeToRefs(useSelectionStore());
const project = useProjectStore();
const guidance = ref('');
let clearGuidance: ReturnType<typeof setTimeout> | undefined;

function selectedTargetName(ids: readonly string[]): string | null {
	if (ids.length !== 1) return null;
	const id = ids[0];
	return project.zones.get(id)?.name ?? structureRecords(project.structure, project.plan?.id ?? '', project.plan?.spatialElements).find(item => item.id === id)?.name ?? null;
}

function selectionGuidance(ids: readonly string[]): string | null {
	const target = selectedTargetName(ids);
	return target === null ? null : `${tr('editor.input.current-target', { target })} ${tr('editor.input.overlap-cycle-guidance')}`;
}

/**
 * Set SYNCHRONOUSLY, so the very next render paints it, and cleared on a real
 * `setTimeout(…, 0)` rather than on the following `nextTick()`: this store's own `settle()`
 * test helper waits out exactly one such timer, so a `nextTick()`-only clear would already be
 * gone by the time any assertion built on `settle()` ran, and the pair this announcement
 * exists to prove — "shown once, gone before the next unrelated change" — would be
 * unobservable from outside a single tick. The `await nextTick()` before arming the timer is
 * what lets a render see the guidance text before the countdown to clear it begins.
 *
 * Guarded on `previous.length > 0` rather than firing on every empty selection: the very
 * first render (`previous` is always `[]` on this watcher's own creation) must not announce
 * anything, since nothing was ever selected to clear.
 */
watch(selectedIds, async (ids, previous) => {
	clearTimeout(clearGuidance);
	const message = ids.length === 0 && previous.length > 0
		? tr('editor.inspector.floor.guidance')
		: ids.length === 1 && (previous.length !== 1 || previous[0] !== ids[0])
			? selectionGuidance(ids)
			: null;
	if (message === null) return;
	guidance.value = message;
	await nextTick();
	clearGuidance = setTimeout(() => {
		guidance.value = '';
	}, 0);
});
onBeforeUnmount(() => { clearTimeout(clearGuidance); });
</script>

<template>
	<!-- Visually hidden: this line is for assistive tech, `FloorSpatialLists` draws the visible hint.
		A drawn line here took layout for one tick on every deselect, pushing the canvas down. -->
	<p
		class="rp-selection-guidance rp-visually-hidden"
		role="status"
	>
		{{ guidance }}
	</p>
</template>
