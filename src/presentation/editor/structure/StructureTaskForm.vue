<script setup lang="ts">
import OpeningSwingFields from './OpeningSwingFields.vue';
import { nativeSubmitKey as keydown } from "../forms/nativeSubmitKey";
import { computed, useId } from 'vue';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { tr } from '../../i18n/strings';
import { closedChain } from '../../../domain/spatial/structureGeometry';
import { formatMetres } from '../shell/formatLength';
import { spatialMessage } from './spatialMessage';
const task = useEditorRuntime().structureTask, draft = task.draft, project = useProjectStore();
const { formEl: root, focusFirstInvalidControl } = useInvalidFieldFocus(), errorId = useId();
const wall = computed(() => draft.kind === 'draw-wall');
const closed = computed(() => wall.value && closedChain(draft.points));
const namingRoom = computed(() => wall.value && draft.room);
const describedBy = computed(() => draft.error ? errorId : undefined);
const instructions = computed(() => tr(wall.value ? 'editor.structure.instructions' : 'editor.structure.host-instructions'));
const pointAction = computed(() => tr(draft.points.length ? 'editor.structure.add-segment' : 'editor.structure.first-point'));
const snapFeedback = computed(() => tr(draft.snapped ? 'editor.structure.snapped' : 'editor.structure.unsnapped'));
const measurements = computed(() => {
	const a = draft.points[draft.points.length - 1], b = draft.cursor;
	return a && b ? `${formatMetres(Math.hypot(b.x - a.x, b.y - a.y))} m · ${Math.round(Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI)}°` : '';
});
const fields = computed(() => wall.value ? (draft.points.length ? ['length', 'angle'] as const : ['x', 'y'] as const) : ['offset', 'width', 'openingHeight', 'sill'] as const);
function add(): void {
	if (task.addNumeric()) root.value?.querySelector<HTMLInputElement>('input')?.focus();
	else void focusFirstInvalidControl();
}
function submit(): void { if (wall.value) add(); else void task.finish(); }

</script>
<template>
	<form
		ref="root"
		class="rp-structure-task"
		@submit.prevent="submit"
		@keydown="keydown"
	>
		<h3>{{ tr(wall ? 'editor.creation.new-walls' : `editor.add.${draft.kind === 'place-window' ? 'window' : draft.kind === 'place-door' ? 'door' : 'opening'}.label`) }}</h3>
		<p>{{ instructions }}</p>
		<p
			v-if="draft.loading"
			role="status"
		>
			{{ tr('editor.loading') }}
		</p>
		<p
			v-if="draft.error"
			:id="errorId"
			role="alert"
		>
			{{ spatialMessage(draft.error) }}
		</p>
		<p
			v-if="draft.conflict"
			role="status"
		>
			{{ tr('editor.structure.conflict') }}
		</p>
		<label
			v-if="!wall"
			class="rp-dialog-field"
		>{{ tr('editor.structure.host') }}
			<select
				v-model="draft.text.hostId"
				:aria-disabled="task.blocked.value"
				:disabled="task.blocked.value"
				@change="draft.error = null"
			>
				<option value="">{{ tr('editor.structure.choose-wall') }}</option>
				<option
					v-for="(host, index) in project.structure.walls"
					:key="host.id"
					:value="host.id"
				>{{ tr('editor.structure.wall-number', { n: String(index + 1) }) }}</option>
			</select>
		</label>
		<label
			v-for="field in fields"
			:key="field"
			class="rp-dialog-field"
		>{{ tr(`editor.structure.${field}`) }}
			<input
				v-model="draft.text[field]"
				:name="field"
				type="text"
				inputmode="decimal"
				:readonly="task.blocked.value"
				:aria-invalid="draft.error !== null"
				:aria-describedby="describedBy"
			>
		</label>
		<OpeningSwingFields
			v-if="!wall && draft.kind !== 'place-opening'"
			v-model="draft.swing"
			:disabled="task.blocked.value"
		/>
		<button
			v-if="wall"
			type="submit"
			:aria-disabled="task.blocked.value"
		>
			{{ pointAction }}
		</button>
		<details v-if="wall">
			<summary>{{ tr('editor.structure.dimensions') }}</summary>
			<label
				v-for="field in (['height', 'thickness'] as const)"
				:key="field"
				class="rp-dialog-field"
			>{{ tr(`editor.structure.${field}`) }}
				<input
					v-model="draft.text[field]"
					:name="field"
					type="text"
					inputmode="decimal"
					:readonly="task.blocked.value"
				>
			</label>
		</details>
		<p v-if="wall">
			{{ tr('editor.structure.points', { n: String(draft.points.length) }) }} · {{ measurements }}
		</p>
		<p role="status">
			{{ snapFeedback }}
		</p>
		<div
			v-if="wall"
			class="rp-dialog-actions"
		>
			<button
				type="button"
				:aria-disabled="task.blocked.value"
				@click="task.undoPoint()"
			>
				{{ tr('editor.structure.undo-point') }}
			</button>
			<button
				type="button"
				:aria-disabled="task.blocked.value"
				@click="task.closeLoop()"
			>
				{{ tr('editor.structure.close-loop') }}
			</button>
		</div>
		<label
			v-if="closed"
			class="rp-structure-task__room"
		><input
			v-model="draft.room"
			type="checkbox"
			:disabled="task.blocked.value"
		>{{ tr('editor.structure.create-room') }}</label>
		<label
			v-if="namingRoom"
			class="rp-dialog-field"
		>{{ tr('editor.structure.room-name') }}<input
			v-model="draft.roomName"
			type="text"
			:readonly="task.blocked.value"
		></label>
		<button
			type="button"
			:aria-disabled="task.blocked.value"
			@click="task.finish()"
		>
			{{ tr(wall ? 'editor.creation.finish-walls' : 'editor.creation.finish-opening') }}
		</button>
	</form>
</template>
