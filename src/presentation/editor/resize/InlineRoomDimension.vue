<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import type { RoomDimensionDraft } from './roomDimensionDraft';
import { tr } from '../../i18n/strings';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import FieldError from '../../components/FieldError.vue';
import FormBanner from '../../components/FormBanner.vue';

const props = defineProps<{ draft: RoomDimensionDraft; cancel(): void }>();
const control = ref<HTMLInputElement | null>(null);
onMounted(() => { void nextTick(() => {
	const input = control.value;
	if (!input?.isConnected) return;
	const active = input.ownerDocument.activeElement;
	const origin = active?.getAttribute('data-rp-dimension') === props.draft.axis && input.closest('.rp-dimension-labels')?.contains(active);
	if (active !== input.ownerDocument.body && !origin) return;
	input.focus(); input.select();
}); });
async function submit(): Promise<void> {
	await props.draft.submit();
	if (props.draft.error.value) control.value?.focus();
}
function updateInput(event: Event): void {
	const target = event.target as HTMLInputElement;
	props.draft.input(target.value);
	target.value = props.draft.form.values.value[props.draft.axis];
}
function keydown(event: KeyboardEvent): void {
	nativeSubmitKey(event);
	event.stopPropagation();
	if (event.key === 'Escape' && !event.repeat && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
		event.preventDefault();
		props.cancel();
	}
}
</script>

<template>
	<form
		class="rp-inline-dimension"
		data-rp-form="room-dimension"
		:aria-busy="draft.controls.busy.value"
		:aria-label="tr('editor.resize.title', { name: draft.name })"
		@submit.prevent="submit"
		@keydown="keydown"
	>
		<p class="rp-inline-dimension__subject">
			{{ draft.name }}
		</p>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="draft.error.value"
		>
			<label :for="inputId">{{ tr(draft.axis === 'width' ? 'editor.room.width' : 'editor.room.depth') }}</label>
			<input
				:id="inputId"
				ref="control"
				v-bind="aria"
				type="text"
				inputmode="decimal"
				:name="draft.axis"
				:value="draft.form.values.value[draft.axis]"
				:readonly="draft.blocked.value"
				@input="updateInput"
			>
		</FieldError>
		<FormBanner :message="draft.form.banner.value" />
		<p
			v-if="!draft.controls.current.value"
			role="status"
		>
			{{ tr('editor.dimension.context-changed') }}
		</p>
		<p
			v-else-if="draft.controls.latest.value !== null"
			role="status"
		>
			{{ draft.controls.latest.value }}
		</p>
		<p
			v-else-if="draft.controls.blocked.value"
			role="status"
		>
			{{ tr('editor.resize.paused') }}
		</p>
		<div class="rp-inline-dimension__actions">
			<button
				type="submit"
				:aria-disabled="draft.blocked.value"
			>
				{{ tr('editor.resize.apply') }}
			</button>
			<button
				type="button"
				:aria-disabled="draft.controls.busy.value"
				@click="cancel()"
			>
				{{ tr('editor.task.cancel') }}
			</button>
		</div>
	</form>
</template>
