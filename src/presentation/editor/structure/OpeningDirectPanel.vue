<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import { formatMetres } from '../shell/formatLength';
import { spatialMessage } from './spatialMessage';
import { tr } from '../../i18n/strings';
import OpeningSwingFields from './OpeningSwingFields.vue';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { plainPress } from '../surface/keyboard';
import { useTaskbarClearance } from '../shell/useTaskbarClearance';
import { openingDirectLayout } from './openingDirectLayout';
import { useOpeningDirectCamera } from './openingDirectCamera';

const runtime = useEditorRuntime(), project = useProjectStore(), editor = useEditorStore(), selection = useSelectionStore(), session = useRenovationSession(), workspace = useWorkspaceStore();
const control = runtime.structureActions.openingDirect;
const props = defineProps<{ dock: HTMLElement | null; nonspatial?: boolean }>();
const emit = defineEmits<{ docked: [value: boolean] }>();
const anchor = ref<HTMLElement | null>(null), panel = ref<HTMLElement | null>(null);
const clearance = useTaskbarClearance(anchor), titleId = useId(), errorId = useId(), menu = ref<HTMLDetailsElement | null>(null);
const fields = ['width', 'offset', 'swing'] as const;
const selected = computed(() => selection.selectedIds.length === 1 ? project.structure.openings.find(item => item.id === selection.selectedIds[0] && (item.kind === 'door' || item.kind === 'window')) : undefined);
const host = computed(() => selected.value ? project.structure.walls.find(item => item.id === selected.value?.hostId) : undefined);
const openingLabel = computed(() => selected.value ? tr(`editor.add.${selected.value.kind}.label`) : '');
const hostLabel = computed(() => host.value ? tr('editor.structure.wall-number', { n: String(project.structure.walls.findIndex(item => item.id === host.value?.id) + 1) }) : '');
const visible = computed(() => !!selected.value && !!host.value && workspace.layerVisibility.architecture && session.perspective === 'plan' && runtime.activeToolId.value === 'select' && !runtime.toolManager.gestureInFlight && !control.target.value && !runtime.structureActions.active.value);
const error = computed(() => control.error.value ? spatialMessage(control.error.value) : control.invalid.value ? tr('editor.structure.error.numeric') : '');
const layout = computed(() => selected.value && host.value ? openingDirectLayout(selected.value, host.value, editor.viewport, editor.stageSize.width, editor.stageSize.height - clearance.value) : null);
const docked = computed(() => props.nonspatial || !layout.value || Number.parseFloat(layout.value.maxHeight) < 420);
watch(docked, value => emit('docked', value), { immediate: true });
useOpeningDirectCamera(editor, control.target, computed(() => docked.value && !props.nonspatial), clearance, () => ({ opening: selected.value, wall: host.value }));
let root: HTMLElement | null = null;
async function begin(event: Event, field: 'width' | 'offset' | 'swing'): Promise<void> { if (menu.value) menu.value.open = false; await control.begin(selected.value?.id ?? '', event.currentTarget as HTMLElement, field); }
function cancel(): void { control.close(); }
function key(event: KeyboardEvent): void {
	if (event.key === 'Escape' && plainPress(event) && !event.isComposing) {
		if (menu.value?.open) { event.preventDefault(); event.stopPropagation(); menu.value.open = false; menu.value.querySelector('summary')?.focus(); }
		else if (control.target.value) { event.preventDefault(); event.stopPropagation(); cancel(); }
	}
	if (panel.value?.contains(event.target as Node)) nativeSubmitKey(event);
}
function outside(event: PointerEvent): void { if (control.target.value && !control.busy.value && !panel.value?.contains(event.target as Node)) cancel(); }
function restoreFocus(source: HTMLElement | null): void {
	const fallback = anchor.value?.querySelector<HTMLElement>('[data-rp-opening-menu]') ?? root?.querySelector<HTMLElement>('[data-rp-action="opening-size-swing"], [data-rp-rail="details"], .rp-plan-canvas');
	(source?.isConnected ? source : fallback)?.focus();
}
watch([control.target, control.loading], async ([id, loading], [previous]) => {
	if (id && !loading) { await nextTick(); panel.value?.querySelector<HTMLElement>(control.focusField.value === 'swing' ? '[name="opening-hinge"]' : `[name="${control.focusField.value}"]`)?.focus(); }
	else if (!id && previous) {
		const focused = panel.value?.contains(anchor.value?.ownerDocument.activeElement ?? null), source = control.opener.value;
		await nextTick();
		if (focused) restoreFocus(source);
	}
});
onMounted(() => { root = anchor.value?.closest<HTMLElement>('.renovation-plan-editor') ?? null; root?.addEventListener('pointerdown', outside, true); root?.addEventListener('keydown', key, true); });
onBeforeUnmount(() => { control.close(); root?.removeEventListener('pointerdown', outside, true); root?.removeEventListener('keydown', key, true); });
</script>

<template>
	<div
		ref="anchor"
		class="rp-opening-direct-anchor"
		:class="{ 'is-nonspatial': props.nonspatial }"
	>
		<div
			v-if="visible"
			class="rp-opening-direct-action"
			:style="props.nonspatial ? undefined : layout ?? undefined"
			role="group"
			:aria-label="tr('editor.opening.direct.action')"
		>
			<button
				type="button"
				data-rp-action="opening-width"
				@click="begin($event, 'width')"
			>
				{{ tr('editor.opening.direct.width') }}
			</button>
			<button
				type="button"
				data-rp-action="opening-offset"
				@click="begin($event, 'offset')"
			>
				{{ tr('editor.opening.direct.offset') }}
			</button>
			<button
				type="button"
				data-rp-action="opening-swing"
				@click="begin($event, 'swing')"
			>
				{{ tr('editor.opening.direct.swing') }}
			</button>
			<details ref="menu">
				<summary data-rp-opening-menu>
					{{ tr('editor.opening.direct.action') }}
				</summary>
				<div class="rp-opening-direct-menu">
					<button
						v-for="field in fields"
						:key="field"
						type="button"
						@click="begin($event, field)"
					>
						{{ tr(`editor.opening.direct.${field}`) }}
					</button>
				</div>
			</details>
		</div>
		<Teleport
			v-if="props.dock"
			:to="props.dock"
			:disabled="!docked"
		>
			<form
				v-if="control.target.value"
				ref="panel"
				class="rp-opening-direct-panel"
				:class="{ 'is-floating': !docked }"
				:style="docked ? undefined : layout ?? undefined"
				:aria-labelledby="titleId"
				:aria-busy="control.loading.value || control.busy.value"
				@submit.prevent="control.apply"
				@keydown="key"
				@pointerdown.stop
				@pointerup.stop
				@wheel.stop
			>
				<header>
					<h3 :id="titleId">
						{{ tr('editor.opening.direct.title', { opening: openingLabel }) }}
					</h3><p>{{ tr('editor.opening.direct.host', { host: hostLabel }) }}</p>
				</header>
				<p
					v-if="control.loading.value"
					role="status"
				>
					{{ tr('editor.loading') }}
				</p>
				<p class="rp-opening-direct-facts">
					{{ tr('editor.structure.width') }}: {{ formatMetres(selected?.width ?? 0) }} m · {{ tr('editor.structure.offset') }}: {{ formatMetres(selected?.offset ?? 0) }} m
				</p>
				<label class="rp-dialog-field">{{ tr('editor.structure.width') }}<input
					name="width"
					type="text"
					inputmode="decimal"
					:value="control.width.value"
					:readonly="control.paused.value"
					:aria-describedby="error ? errorId : undefined"
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
					:readonly="control.paused.value"
					:aria-describedby="error ? errorId : undefined"
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
					:id="errorId"
					role="alert"
				>
					{{ error }}
				</p>
				<div class="rp-opening-direct-footer">
					<button
						type="button"
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
		</Teleport>
	</div>
</template>
