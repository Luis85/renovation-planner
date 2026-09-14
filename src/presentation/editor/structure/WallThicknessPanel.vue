<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { tr } from '../../i18n/strings';
import { formatMetres } from '../shell/formatLength';
import { spatialMessage } from './spatialMessage';
import { MAX_WALL_THICKNESS, MIN_WALL_THICKNESS, WALL_THICKNESS_STEP } from '../../../domain/spatial/wallThickness';
import { useTaskbarClearance } from '../shell/useTaskbarClearance';
import HostIcon from '../../components/HostIcon.vue';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';

const control = useEditorRuntime().structureActions.thickness, project = useProjectStore();
const anchor = ref<HTMLElement | null>(null), panel = ref<HTMLElement | null>(null), clearance = useTaskbarClearance(anchor);
const titleId = useId(), hintId = useId(), errorId = useId();
const title = computed(() => tr('editor.wall-thickness.title', { wall: tr('editor.structure.wall-number', { n: String(project.structure.walls.findIndex(wall => wall.id === control.target.value) + 1) }) }));
const invalid = computed(() => !control.loading.value && !control.proposal.value);
const feedback = computed(() => control.error.value ? spatialMessage(control.error.value) : invalid.value ? tr('editor.wall-thickness.invalid') : '');
let opener: HTMLElement | null = null;
watch(control.target, async (id, previous) => {
	if (id) { opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; await nextTick(); if (control.target.value === id) panel.value?.querySelector<HTMLInputElement>('input')?.focus(); }
	else if (previous) { const focused = panel.value?.contains(document.activeElement); await nextTick(); if (focused) (opener?.isConnected ? opener : anchor.value?.closest<HTMLElement>('.rp-plan-canvas'))?.focus(); }
}, { flush: 'pre' });
async function submit(): Promise<void> {
	if (invalid.value) { panel.value?.querySelector<HTMLInputElement>('input')?.focus(); return; }
	await control.apply();
}
function key(event: KeyboardEvent): void {
	if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!control.busy.value) control.close(); }
	else nativeSubmitKey(event);
}
let host: HTMLElement | null = null;
function outside(event: PointerEvent): void { if (control.target.value && !control.busy.value && !panel.value?.contains(event.target as Node)) control.close(); }
function escape(event: KeyboardEvent): void { if (control.target.value && event.key === 'Escape') key(event); }
onMounted(() => {
	host = anchor.value?.closest<HTMLElement>('.renovation-plan-editor') ?? null;
	host?.addEventListener('pointerdown', outside, true); host?.addEventListener('keydown', escape, true);
});
onBeforeUnmount(() => { host?.removeEventListener('pointerdown', outside, true); host?.removeEventListener('keydown', escape, true); });
</script>
<template>
	<div
		ref="anchor"
		class="rp-wall-thickness-anchor"
	>
		<form
			v-if="control.target.value"
			ref="panel"
			class="rp-wall-thickness-panel"
			:style="{ bottom: `${clearance}px` }"
			:aria-labelledby="titleId"
			:aria-busy="control.busy.value || control.loading.value"
			@submit.prevent="submit"
			@keydown="key"
		>
			<h3 :id="titleId">
				{{ title }}
			</h3>
			<p :id="hintId">
				{{ tr('editor.wall-thickness.symmetric') }}
			</p>
			<label class="rp-dialog-field">
				{{ tr('editor.structure.thickness') }}
				<input
					name="wall-thickness"
					type="text"
					inputmode="decimal"
					:value="control.text.value"
					:readonly="control.paused.value"
					:aria-invalid="invalid"
					:aria-describedby="feedback ? `${hintId} ${errorId}` : hintId"
					@input="control.update(($event.target as HTMLInputElement).value)"
				>
			</label>
			<div
				v-if="control.mode.value === 'adjust'"
				class="rp-wall-thickness-stepper"
				role="group"
				:aria-label="tr('editor.wall-thickness.adjust')"
			>
				<button
					type="button"
					:aria-label="tr('editor.wall-thickness.decrease')"
					:aria-disabled="control.paused.value || invalid || control.value.value === MIN_WALL_THICKNESS"
					@click="control.increment(-1)"
				>
					<HostIcon name="minus" />
				</button>
				<span>{{ tr('editor.wall-thickness.step', { value: formatMetres(WALL_THICKNESS_STEP) }) }}</span>
				<button
					type="button"
					:aria-label="tr('editor.wall-thickness.increase')"
					:aria-disabled="control.paused.value || invalid || control.value.value === MAX_WALL_THICKNESS"
					@click="control.increment(1)"
				>
					<HostIcon name="plus" />
				</button>
			</div>
			<p
				v-if="feedback"
				:id="errorId"
				role="alert"
			>
				{{ feedback }}
			</p>
			<p
				role="status"
				aria-live="polite"
			>
				{{ tr(control.loading.value ? 'editor.loading' : control.busy.value ? 'editor.wall-thickness.saving' : 'editor.wall-thickness.preview', { value: control.value.value === null ? '—' : formatMetres(control.value.value) }) }}
			</p>
			<div class="rp-wall-thickness-footer">
				<button
					type="button"
					:aria-disabled="control.busy.value"
					@click="!control.busy.value && control.close()"
				>
					{{ tr('dialog.cancel') }}
				</button>
				<button
					type="submit"
					class="mod-cta"
					:aria-disabled="control.paused.value || invalid || !control.changed.value"
				>
					{{ tr('editor.wall-thickness.apply') }}
				</button>
			</div>
		</form>
	</div>
</template>
