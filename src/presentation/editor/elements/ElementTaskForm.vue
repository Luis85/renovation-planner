<script setup lang="ts">
import DraftRecovery from '../forms/DraftRecovery.vue';
import { computed } from 'vue';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { parseCoordinateMetres, formatMetres } from '../shell/formatLength';
import { zoneTypeLabel } from '../shell/zoneTypeLabel';
const runtime = useEditorRuntime(), task = runtime.elementTask, draft = task.draft;
const point = computed(() => {
	const x = parseCoordinateMetres(draft.text.x), y = parseCoordinateMetres(draft.text.y);
	return x.ok && y.ok ? { x: x.mm, y: y.mm } : null;
});
const addBlocked = computed(() => task.blocked.value || draft.pendingInput || !point.value || (draft.kind === 'measurement' && draft.points.length === 2));
function input(key: 'x' | 'y' | 'name', event: Event): void {
	const control = event.target as HTMLInputElement;
	if (task.blocked.value) { control.value = key === 'name' ? draft.name : draft.text[key]; return; }
	if (key === 'name') draft.name = control.value; else draft.text[key] = control.value;
}
function add(): void { if (!addBlocked.value && point.value) task.addPoint(point.value); }
</script>
<template>
	<section
		class="rp-element-task"
		data-rp-form="element-create"
	>
		<h3>{{ tr(zoneTypeLabel(draft.kind)) }}</h3>
		<p>{{ tr('editor.element.create-hint') }}</p>
		<p
			v-if="draft.error"
			role="alert"
		>
			{{ trError(draft.error) }}
		</p>
		<label class="rp-dialog-field">{{ tr('editor.area.name') }}<input
			name="element-name"
			type="text"
			:value="draft.name"
			:readonly="task.blocked.value"
			@input="input('name', $event)"
		></label>
		<form @submit.prevent="add">
			<DraftRecovery
				v-if="task.needsRead.value || runtime.writesBlocked.value"
				:retry="task.retry"
				:open-source="runtime.openPlanNote"
			/>
			<label
				v-for="axis in ['x', 'y'] as const"
				:key="axis"
				class="rp-dialog-field"
			>{{ tr(axis === 'x' ? 'editor.area.x' : 'editor.area.y') }}<input
				:name="'element-' + axis"
				type="text"
				inputmode="decimal"
				:value="draft.text[axis]"
				:readonly="task.blocked.value"
				@input="input(axis, $event)"
			></label>
			<button
				type="submit"
				:aria-disabled="addBlocked"
			>
				{{ tr('editor.element.add-point') }}
			</button>
		</form>
		<ol>
			<li
				v-for="(value, index) in draft.points"
				:key="index"
			>
				{{ formatMetres(value.x) }} m, {{ formatMetres(value.y) }} m
			</li>
		</ol>
		<button
			type="button"
			:aria-disabled="task.blocked.value || draft.pendingInput || !!draft.text.x || !!draft.text.y || !draft.points.length"
			@click="task.undoPoint()"
		>
			{{ tr('editor.element.undo-point') }}
		</button>
		<div class="rp-dialog-actions">
			<button
				type="button"
				data-rp-action="finish-element"
				:aria-disabled="!task.canFinish.value"
				@click="task.finish()"
			>
				{{ tr('editor.element.finish') }}
			</button>
			<button
				type="button"
				:aria-disabled="draft.busy"
				@click="runtime.cancelActiveTask()"
			>
				{{ tr('editor.element.cancel') }}
			</button>
		</div>
	</section>
</template>
