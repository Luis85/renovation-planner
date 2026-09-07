<script setup lang="ts">
import { computed, nextTick, ref, useId, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import FieldError from '../../components/FieldError.vue';
import { tr } from '../../i18n/strings';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { emptyObjectRectangle, objectRectangleProposal, type ObjectRectangleText, type RectangleField } from './objectRectangleInput';

const props = defineProps<{ task: {
	draft: { rectangle: ObjectRectangleText; text: { x: string; y: string }; points: readonly Point[]; pendingInput: boolean };
	blocked: Readonly<Ref<boolean>>;
	setPoints(points: readonly Point[]): boolean;
} }>();
const task = props.task, draft = task.draft, root = ref<HTMLElement | null>(null), hintId = useId();
const fields = ['x', 'y', 'width', 'depth'] as const;
const proposal = computed(() => objectRectangleProposal(draft.rectangle));
const editable = computed(() => !task.blocked.value && !draft.text.x && !draft.text.y);
function message(field: RectangleField): string | null {
	const error = proposal.value.errors[field];
	if (!draft.pendingInput || error === null) return null;
	const position = field === 'x' || field === 'y';
	return tr(position ? error === 'too-large' ? 'editor.object.position-too-large' : 'editor.object.invalid-position'
		: error === 'too-large' ? 'editor.object.size-too-large' : 'editor.object.invalid-size');
}
function input(field: RectangleField, event: Event): void {
	const control = event.target as HTMLInputElement;
	if (!editable.value) { control.value = draft.rectangle[field]; return; }
	draft.rectangle[field] = control.value; draft.pendingInput = true;
}
function apply(): void {
	if (!editable.value) return;
	draft.pendingInput = true;
	if (proposal.value.points && task.setPoints(proposal.value.points)) draft.pendingInput = false;
	else void nextTick(() => root.value?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
}
function discard(): void {
	if (!editable.value || !task.setPoints(draft.points)) return;
	draft.rectangle = emptyObjectRectangle(); draft.pendingInput = false;
	void nextTick(() => root.value?.querySelector<HTMLInputElement>('input')?.focus());
}
function onKey(event: KeyboardEvent): void {
	if (event.key !== 'Enter') return;
	nativeSubmitKey(event);
	if (event.defaultPrevented) return;
	event.preventDefault(); apply();
}
</script>
<template>
	<details
		ref="root"
		class="rp-object-rectangle"
	>
		<summary>{{ tr('editor.object.rectangle') }}</summary>
		<p :id="hintId">
			{{ tr('editor.object.rectangle-hint') }}
		</p>
		<div class="rp-object-rectangle__fields">
			<FieldError
				v-for="field in fields"
				:key="field"
				v-slot="{ inputId, aria }"
				:message="message(field)"
			>
				<label :for="inputId">{{ tr(field === 'x' ? 'editor.area.x' : field === 'y' ? 'editor.area.y' : field === 'width' ? 'editor.room.width' : 'editor.room.depth') }}</label>
				<input
					:id="inputId"
					v-bind="aria"
					:name="`object-${field}`"
					type="text"
					inputmode="decimal"
					:value="draft.rectangle[field]"
					:readonly="!editable"
					:aria-describedby="[hintId, aria['aria-describedby']].filter(Boolean).join(' ')"
					@input="input(field, $event)"
					@keydown="onKey"
				>
			</FieldError>
		</div>
		<div class="rp-dialog-actions">
			<button
				type="button"
				data-rp-action="apply-object-rectangle"
				:aria-disabled="!editable"
				@click="apply"
			>
				{{ tr('editor.object.apply-rectangle') }}
			</button>
			<button
				type="button"
				data-rp-action="discard-object-rectangle"
				:aria-disabled="!editable"
				@click="discard"
			>
				{{ tr('editor.object.discard-rectangle') }}
			</button>
		</div>
	</details>
	<p
		v-if="draft.pendingInput"
		role="status"
	>
		{{ tr('editor.object.pending-rectangle') }}
	</p>
</template>
