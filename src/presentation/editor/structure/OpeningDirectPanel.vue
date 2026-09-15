<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { alongWall } from '../../../domain/spatial/Structure';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';
import { formatMetres } from '../shell/formatLength';
import { spatialMessage } from './spatialMessage';
import { tr } from '../../i18n/strings';
import OpeningSwingFields from './OpeningSwingFields.vue';

const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), session = useRenovationSession(), workspace = useWorkspaceStore();
const control = runtime.structureActions.openingDirect;
const anchor = ref<HTMLElement | null>(null), panel = ref<HTMLElement | null>(null);
const selected = computed(() => selection.selectedIds.length === 1 ? project.structure.openings.find(item => item.id === selection.selectedIds[0] && (item.kind === 'door' || item.kind === 'window')) : undefined);
const host = computed(() => selected.value ? project.structure.walls.find(item => item.id === selected.value?.hostId) : undefined);
const openingLabel = computed(() => selected.value ? tr(`editor.add.${selected.value.kind}.label`) : '');
const hostLabel = computed(() => host.value ? tr('editor.structure.wall-number', { n: String(project.structure.walls.findIndex(item => item.id === host.value?.id) + 1) }) : '');
const visible = computed(() => !!selected.value && !!host.value && workspace.layerVisibility.architecture && session.perspective === 'plan' && runtime.activeToolId.value === 'select' && !runtime.toolManager.gestureInFlight && !control.target.value && !runtime.structureActions.active.value);
const error = computed(() => control.error.value ? spatialMessage(control.error.value) : control.invalid.value ? tr('editor.structure.error.numeric') : '');
const style = computed(() => {
	if (!selected.value || !host.value) return {};
	const point = worldToScreen(alongWall(host.value, selected.value.offset + selected.value.width / 2), editor.viewport, STAGE_PIXELS);
	return { left: `${Math.max(8, Math.min(editor.stageSize.width - 172, point.x + 18))}px`, top: `${Math.max(56, Math.min(editor.stageSize.height - 132, point.y - 24))}px` };
});
let root: HTMLElement | null = null;
async function begin(event: Event, field: 'width' | 'offset' | 'swing'): Promise<void> { await control.begin(selected.value?.id ?? '', event.currentTarget as HTMLElement, field); }
function cancel(): void { if (!control.busy.value) control.close(); }
function key(event: KeyboardEvent): void { if (control.target.value && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } }
function outside(event: PointerEvent): void { if (control.target.value && !control.busy.value && !panel.value?.contains(event.target as Node)) cancel(); }
watch(control.target, async (id, previous) => {
	if (id) { await nextTick(); panel.value?.querySelector<HTMLElement>(control.focusField.value === 'swing' ? '[name="opening-hinge"]' : `[name="${control.focusField.value}"]`)?.focus(); }
	else if (previous) { const owner = anchor.value?.ownerDocument; const focused = panel.value?.contains(owner?.activeElement ?? null); await nextTick(); if (focused) (control.opener.value?.isConnected ? control.opener.value : anchor.value?.closest<HTMLElement>('.rp-plan-canvas'))?.focus(); }
});
onMounted(() => { root = anchor.value?.closest<HTMLElement>('.renovation-plan-editor') ?? null; root?.addEventListener('pointerdown', outside, true); root?.addEventListener('keydown', key, true); });
onBeforeUnmount(() => { root?.removeEventListener('pointerdown', outside, true); root?.removeEventListener('keydown', key, true); });
</script>

<template>
	<div
		ref="anchor"
		class="rp-opening-direct-anchor"
	>
		<div
			v-if="visible"
			class="rp-opening-direct-action"
			:style="style"
			role="group"
			:aria-label="tr('editor.opening.direct.action')"
		>
			<button type="button" data-rp-action="opening-width" @click="begin($event, 'width')">{{ tr('editor.opening.direct.width') }}</button>
			<button type="button" data-rp-action="opening-offset" @click="begin($event, 'offset')">{{ tr('editor.opening.direct.offset') }}</button>
			<button type="button" data-rp-action="opening-swing" @click="begin($event, 'swing')">{{ tr('editor.opening.direct.swing') }}</button>
		</div>
		<form
			v-if="control.target.value"
			ref="panel"
			class="rp-opening-direct-panel"
			:aria-busy="control.loading.value || control.busy.value"
			@submit.prevent="control.apply"
			@keydown="key"
		>
			<header><h3>{{ tr('editor.opening.direct.title', { opening: openingLabel }) }}</h3><p>{{ tr('editor.opening.direct.host', { host: hostLabel }) }}</p></header>
			<p class="rp-opening-direct-facts">
				{{ tr('editor.structure.width') }}: {{ formatMetres(selected?.width ?? 0) }} m · {{ tr('editor.structure.offset') }}: {{ formatMetres(selected?.offset ?? 0) }} m
			</p>
			<label class="rp-dialog-field">{{ tr('editor.structure.width') }}<input
				name="width"
				type="text"
				inputmode="decimal"
				:value="control.width.value"
				:aria-invalid="control.invalid.value || undefined"
				@input="control.update('width', ($event.target as HTMLInputElement).value)"
			></label>
			<div class="rp-opening-direct-stepper">
				<button
					type="button"
					:aria-label="tr('editor.opening.direct.width-decrease')"
					:disabled="control.paused.value"
					@click="control.step('width', -1)"
				>
					− 10 mm
				</button><button
					type="button"
					:aria-label="tr('editor.opening.direct.width-increase')"
					:disabled="control.paused.value"
					@click="control.step('width', 1)"
				>
					+ 10 mm
				</button>
			</div>
			<label class="rp-dialog-field">{{ tr('editor.structure.offset') }}<input
				name="offset"
				type="text"
				inputmode="decimal"
				:value="control.offset.value"
				:aria-invalid="control.invalid.value || undefined"
				@input="control.update('offset', ($event.target as HTMLInputElement).value)"
			></label>
			<div class="rp-opening-direct-stepper">
				<button
					type="button"
					:aria-label="tr('editor.opening.direct.offset-decrease')"
					:disabled="control.paused.value"
					@click="control.step('offset', -1)"
				>
					− 10 mm
				</button><button
					type="button"
					:aria-label="tr('editor.opening.direct.offset-increase')"
					:disabled="control.paused.value"
					@click="control.step('offset', 1)"
				>
					+ 10 mm
				</button>
			</div>
			<OpeningSwingFields
				v-if="control.swing.value"
				:model-value="control.swing.value"
				:disabled="control.paused.value"
				@update:model-value="control.updateSwing"
			/>
			<p
				v-if="error"
				role="alert"
			>
				{{ error }}
			</p>
			<div class="rp-opening-direct-footer">
				<button
					type="button"
					:disabled="control.busy.value"
					@click="cancel"
				>
					{{ tr('dialog.cancel') }}
				</button><button
					type="submit"
					class="mod-cta"
					:disabled="control.paused.value || control.invalid.value || !control.changed.value"
				>
					{{ tr('editor.structure.apply') }}
				</button>
			</div>
		</form>
	</div>
</template>
