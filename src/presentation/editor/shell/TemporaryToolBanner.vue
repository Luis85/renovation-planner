<script setup lang="ts">
/**
 * Task 18: a visible banner naming the active creation task, with a Cancel button. NOT
 * `routeEscape` (R7, 2026-09-04): Cancel LEAVES the task in one gesture — clears any draft
 * and returns to Select, never touching the selection — where Escape (Task 9) instead steps
 * back one interaction at a time through `routeEscape`. Mounted in `PlanEditorRoot`'s canvas
 * overlay slot, over the top edge.
 *
 * `TASKS` covers `draw-polygon`, `draw-room` and `calibrate`: Select, camera mode (`null`)
 * and every designer tool id share no entry, and the `v-if` below is "the active tool has
 * one" rather than "the active tool is not Select" — a table lookup, so a designer tool
 * added to `ToolId` later is silently excluded rather than requiring an edit here to stay
 * excluded.
 *
 * **Task 8: `draw-room` gains a second door onto the SAME action `NewRoomInspector.vue`'s
 * own Create button already dispatches (design spec §5.2, "two doors, one action") —
 * `runtime.createRoom()`, never a second command.** `finish?: true` marks which tasks get
 * one: `calibrate` and `draw-polygon` finish by GESTURE (the second calibration click, the
 * closing vertex), so they declare no `finish` and the button is simply absent rather than a
 * live control that does nothing. Finish is `aria-disabled`, never `:disabled` (the same
 * "no control that does nothing" rule the form's own Create button keeps), bound as a
 * BOOLEAN per Task 7's settled pattern — `vue-tsc` types the attribute `Booleanish`, and the
 * rendered DOM attribute still reads `"true"`/`"false"`. `aria-describedby` names the
 * instruction `<span>` unconditionally: unlike the form's own hint (rendered only while the
 * draft is INCOMPLETE), the instruction here is always in the DOM while the banner is, so the
 * reference can never dangle.
 *
 * **Finish stays keyed on `canCreateRoom` where the form's HINT moved to
 * `roomDraftIncomplete`, and the asymmetry is the point.** `canCreateRoom` is false for the
 * whole of a vault write, which is right for the GESTURE — pressing Finish then answers
 * `'busy'` — and was wrong for the form's sentence, which stated a reason ("size the room and
 * give it a name first") about the very room being written. This button's description is the
 * task INSTRUCTION rather than a blocked-reason, so it says nothing that a write in flight
 * could make false, and there is nothing here to split.
 *
 * `role="status"` on the whole banner: its very appearance is the announcement, the same
 * shape `StatusBar.vue`'s save-state region already uses for `aria-label` on a `role="status"`
 * `<div>`. Deliberately not `aria-live="assertive"`, since naming a task is not an urgent
 * interruption the way a save failure is.
 */
import { computed, nextTick, ref, useId, watch } from 'vue';
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { ToolId } from '../tools/editor-tool';
import { useEditorRuntime } from '../runtime';

const runtime = useEditorRuntime();

const TASKS: Readonly<Partial<Record<ToolId, { nameKey: StringKey; instructionKey: StringKey; finish?: true }>>> = {
	'draw-polygon': { nameKey: 'editor.task.draw-room.name', instructionKey: 'editor.task.draw-room.instruction' },
	'draw-room': { nameKey: 'editor.task.add-room.name', instructionKey: 'editor.task.add-room.instruction', finish: true },
	calibrate: { nameKey: 'editor.task.calibrate.name', instructionKey: 'editor.task.calibrate.instruction' },
};

const task = computed(() => {
	const id = runtime.activeToolId.value;
	return id === null ? null : (TASKS[id] ?? null);
});

const root = ref<HTMLElement | null>(null);
const instructionId = useId();

/**
 * The `aria-disabled` promise kept at the control, not only at the action — the same shape
 * `NewRoomInspector.vue`'s own `onCreate` uses, and it dispatches through the identical
 * `runtime.createRoom()` door: a click on an `aria-disabled` button still fires, so nothing
 * downstream may assume the guard already ran. `writesBlocked` (design spec §2.9) is the
 * second half of that same promise.
 */
function onFinish(): void {
	if (!runtime.canCreateRoom.value || runtime.writesBlocked.value) return;
	void runtime.createRoom();
}

/**
 * Focus recovery for BOTH exits (Cancel and Finish), and NOT `onBeforeUnmount` — measured
 * rather than assumed, against `NewRoomInspector.vue`'s own pattern. That component's root
 * `<section>` carries no `v-if` of its own; ITS PARENT (`EntityInspector.vue`) decides
 * whether to mount the whole component, so leaving the task genuinely unmounts it and
 * `onBeforeUnmount` fires. This banner's root `<div>` carries `v-if="task !== null"` on
 * ITSELF, so ending a task never unmounts this COMPONENT — only stops rendering its content
 * — and a component's `onBeforeUnmount` fires on its OWN teardown, not on an internal `v-if`
 * flipping. Driven directly: a real `<script setup>` root with `v-if` on its outermost
 * element, mounted and then toggled off, calls no `onBeforeUnmount` at all. An earlier draft
 * of this file used it regardless and threw `Cannot read properties of null` the one time it
 * DID fire — at the whole tree's real teardown, by which point `root.value` had already gone
 * null from the task ending first.
 *
 * `watch(task, …)` is the shape that actually reaches this moment: its default 'pre' flush
 * runs BEFORE this component's own DOM patch, so `root.value` still names the about-to-be-
 * removed element when the callback captures it — the same "before" `NewRoomInspector.vue`'s
 * `onBeforeUnmount` gets, reached by a different door. Restoring focus is deferred to
 * `nextTick` so it runs once that patch has actually happened.
 *
 * `root.value` is CAST rather than null-checked, `NewRoomInspector.vue`'s own guarantee
 * applied to a different mechanism: `watch` fires only on an actual change, so a callback
 * reached with `next === null` is a task that WAS active and just ended, and the pre-flush
 * ordering above is what makes `root.value` still that task's element rather than the `null`
 * this ref falls back to once the patch runs — a null branch here would be an arm nothing
 * can drive, driven directly against a real mount in the review that wrote this comment.
 * The ternary is the SAME shape `NewRoomInspector.vue`'s own hand-off uses rather than an
 * early return before it, because this component is mounted only inside `PlanCanvas`'s
 * overlay slot — `.rp-plan-canvas` is always an ancestor — so `closest` genuinely answering
 * null is not a case either file's tests can drive; routing "the banner held no focus"
 * through the same `null` `closest` would otherwise answer is what gives the `!== null`
 * check below a covered false arm at all.
 */
watch(task, (next) => {
	if (next !== null) return;
	const banner = root.value as HTMLElement;
	const canvas = banner.contains(document.activeElement) ? banner.closest<HTMLElement>('.rp-plan-canvas') : null;
	if (canvas !== null) void nextTick(() => canvas.focus());
});
</script>

<template>
	<div
		v-if="task !== null"
		ref="root"
		class="rp-task-banner"
		role="status"
		:aria-label="tr('editor.task.banner')"
	>
		<strong>{{ tr(task.nameKey) }}</strong>
		<span :id="instructionId">{{ tr(task.instructionKey) }}</span>
		<button
			v-if="task.finish"
			type="button"
			class="rp-task-banner__finish"
			:aria-disabled="!runtime.canCreateRoom.value || runtime.writesBlocked.value"
			:aria-describedby="[instructionId, runtime.writesBlocked.value ? runtime.pausedReasonId : null].filter(Boolean).join(' ')"
			@click="onFinish"
		>
			{{ tr('editor.task.finish') }}
		</button>
		<button
			type="button"
			class="rp-task-banner__cancel"
			@click="runtime.cancelActiveTask()"
		>
			{{ tr('editor.task.cancel') }}
		</button>
	</div>
</template>
