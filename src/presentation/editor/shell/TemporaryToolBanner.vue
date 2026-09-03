<script setup lang="ts">
/**
 * Task 18: a visible banner naming the active creation task, with a Cancel button whose
 * behaviour is `routeEscape`'s (Task 9) — a mouse user gets what Escape already gives a
 * keyboard user. Mounted in `PlanEditorRoot`'s canvas overlay slot, over the top edge.
 *
 * `TASKS` covers `draw-polygon` and `calibrate` only: Select, camera mode (`null`) and every
 * designer tool id share no entry, and the `v-if` below is "the active tool has one" rather
 * than "the active tool is not Select" — a table lookup, so a designer tool added to `ToolId`
 * later is silently excluded rather than requiring an edit here to stay excluded.
 *
 * `role="status"` on the whole banner: its very appearance is the announcement, the same
 * shape `StatusBar.vue`'s save-state region already uses for `aria-label` on a `role="status"`
 * `<div>`. Deliberately not `aria-live="assertive"`, since naming a task is not an urgent
 * interruption the way a save failure is.
 */
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { ToolId } from '../tools/editor-tool';
import { useEditorRuntime } from '../runtime';

const runtime = useEditorRuntime();

const TASKS: Readonly<Partial<Record<ToolId, { nameKey: StringKey; instructionKey: StringKey }>>> = {
	'draw-polygon': { nameKey: 'editor.task.draw-room.name', instructionKey: 'editor.task.draw-room.instruction' },
	calibrate: { nameKey: 'editor.task.calibrate.name', instructionKey: 'editor.task.calibrate.instruction' },
};

const task = computed(() => {
	const id = runtime.activeToolId.value;
	return id === null ? null : (TASKS[id] ?? null);
});
</script>

<template>
	<div
		v-if="task !== null"
		class="rp-task-banner"
		role="status"
		:aria-label="tr('editor.task.banner')"
	>
		<strong>{{ tr(task.nameKey) }}</strong>
		<span>{{ tr(task.instructionKey) }}</span>
		<button
			type="button"
			@click="runtime.cancelActiveTask()"
		>
			{{ tr('editor.task.cancel') }}
		</button>
	</div>
</template>
