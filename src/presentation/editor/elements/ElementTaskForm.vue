<script setup lang="ts">
import DraftRecovery from '../forms/DraftRecovery.vue';
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import FieldError from '../../components/FieldError.vue';
import ObjectRectangleFields from './ObjectRectangleFields.vue';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { useEditorRuntime } from '../runtime';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { parseCoordinateMetres, formatMetres } from '../shell/formatLength';
import { zoneTypeLabel } from '../shell/zoneTypeLabel';
const runtime = useEditorRuntime(), task = runtime.elementTask, draft = task.draft;
const taskRoot = ref<HTMLElement | null>(null);
onBeforeUnmount(() => {
	const root = taskRoot.value, editor = root?.closest<HTMLElement>('.renovation-plan-editor');
	if (root?.contains(document.activeElement)) void nextTick(() => { if (editor?.isConnected) editor.querySelector<HTMLElement>('.rp-plan-canvas')?.focus(); });
});
const pointForm = ref<HTMLElement | null>(null), attemptedPoint = ref(false);
const coordinates = computed(() => ({ x: parseCoordinateMetres(draft.text.x), y: parseCoordinateMetres(draft.text.y) }));
const point = computed(() => {
	const { x, y } = coordinates.value;
	return x.ok && y.ok ? { x: x.mm, y: y.mm } : null;
});
const pointRepeated = computed(() => {
	const last = draft.points.at(-1), next = point.value;
	return !!last && !!next && last.x === next.x && last.y === next.y;
});
const addBlocked = computed(() => task.blocked.value || draft.pendingInput || !point.value || pointRepeated.value || (draft.kind === 'measurement' && draft.points.length === 2));
const pointReadonly = computed(() => task.blocked.value || draft.pendingInput);
const undoBlocked = computed(() => pointReadonly.value || !!draft.text.x || !!draft.text.y || !draft.points.length);
function coordinateMessage(axis: 'x' | 'y'): string | null {
	if (axis === 'y' && pointRepeated.value) return tr('editor.element.point-repeated');
	if (!attemptedPoint.value && !draft.text[axis]) return null;
	return coordinates.value[axis].ok ? null : tr('editor.area.coordinate-invalid');
}
function input(key: 'x' | 'y' | 'name', event: Event): void {
	const control = event.target as HTMLInputElement;
	if (task.blocked.value || (key !== 'name' && draft.pendingInput)) { control.value = key === 'name' ? draft.name : draft.text[key]; return; }
	if (key === 'name') draft.name = control.value; else draft.text[key] = control.value;
}
async function add(): Promise<void> {
	if (pointReadonly.value) return;
	attemptedPoint.value = true;
	if (!point.value || pointRepeated.value) { await nextTick(); pointForm.value?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(); return; }
	if (!addBlocked.value && task.addPoint(point.value)) attemptedPoint.value = false;
}
</script>
<template>
	<section
		ref="taskRoot"
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
		<FieldError
			v-slot="{ inputId, aria }"
			:message="draft.name.trim() ? null : tr('editor.element.name-required')"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>{{ tr('editor.room.name') }}<input
				:id="inputId"
				v-bind="aria"
				name="element-name"
				type="text"
				:value="draft.name"
				:readonly="task.blocked.value"
				@input="input('name', $event)"
			></label>
		</FieldError>
		<ObjectRectangleFields
			v-if="draft.kind === 'object'"
			:task="task"
		/>
		<form
			ref="pointForm"
			@submit.prevent="add"
			@keydown="nativeSubmitKey"
		>
			<DraftRecovery
				v-if="task.needsRead.value || runtime.writesBlocked.value"
				:retry="task.retry"
				:open-source="runtime.openPlanNote"
			/>
			<FieldError
				v-for="axis in ['x', 'y'] as const"
				:key="axis"
				v-slot="{ inputId, aria }"
				:message="coordinateMessage(axis)"
			>
				<label
					:for="inputId"
					class="rp-dialog-field"
				>{{ tr(axis === 'x' ? 'editor.area.x' : 'editor.area.y') }}<input
					:id="inputId"
					v-bind="aria"
					:name="'element-' + axis"
					type="text"
					inputmode="decimal"
					:value="draft.text[axis]"
					:readonly="pointReadonly"
					@input="input(axis, $event)"
				></label>
			</FieldError>
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
			:aria-disabled="undoBlocked"
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
