<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref, useId, watch } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useProjectStore } from '../../stores/ProjectStore';
import { useEditorStore } from '../../stores/EditorStore';
import { useDialogStore } from '../../dialogs/dialog-store';
import { tr } from '../../i18n/strings';
import { spatialMessage } from './spatialMessage';
import { formatWallExtent } from './wallExtentInput';
import { useTaskbarClearance } from '../shell/useTaskbarClearance';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
import { wallSideControlLayout } from './wallSideControlLayout';
import WallSideField from './WallSideField.vue';

const control = useEditorRuntime().structureActions.thickness, project = useProjectStore(), editor = useEditorStore(), dialogs = useDialogStore();
const anchor = ref<HTMLElement | null>(null), panel = ref<HTMLElement | null>(null), footer = ref<HTMLElement | null>(null), clearance = useTaskbarClearance(anchor);
const footerHeight = ref(180), cardHeight = ref(144);
const titleId = useId(), hintId = useId(), errorId = useId();
const title = computed(() => tr('editor.wall-thickness.title', { wall: tr('editor.structure.wall-number', { n: String(project.structure.walls.findIndex(wall => wall.id === control.target.value) + 1) }) }));
const invalid = computed(() => !control.loading.value && !control.proposal.value);
const feedback = computed(() => {
	if (control.error.value) return spatialMessage(control.error.value);
	if (control.geometryIssue.value) return tr(control.geometryIssue.value.kind === 'curve-radius' ? 'editor.structure.error.wall-side-curve-radius' : 'editor.structure.error.wall-side-curved-junction');
	return invalid.value ? tr('editor.structure.error.wall-side-extents') : '';
});
const status = computed(() => tr(control.loading.value ? 'editor.loading' : control.busy.value ? 'editor.wall-thickness.saving' : 'editor.wall-side.total', { value: control.total.value === null ? '—' : formatWallExtent(control.total.value) }));
const layout = computed(() => {
	const wall = control.proposal.value?.walls.find(item => item.id === control.target.value) ?? control.original.value;
	return control.mode.value === 'adjust' && wall ? wallSideControlLayout(wall, editor.viewport, { width: editor.stageSize.width, bottom: editor.stageSize.height - clearance.value - footerHeight.value - 12, cardHeight: cardHeight.value }, project.structure.openings) : null;
});
const fields = computed(() => layout.value ? layout.value.map(item => ({ ...item, style: { left: `${item.x}px`, top: `${item.y}px`, width: `${item.width}px` } })) : (['a', 'b'] as const).map(side => ({ side, style: undefined })));
const panelStyle = computed(() => layout.value ? undefined : { bottom: `${clearance.value}px` });
const summaryStyle = computed(() => layout.value ? { bottom: `${clearance.value}px` } : undefined);
const descriptionIds = computed(() => feedback.value ? `${hintId} ${errorId}` : hintId);
const isBusy = computed(() => control.busy.value || control.loading.value);
const cannotApply = computed(() => control.paused.value || invalid.value || !control.changed.value);
watch([panel, footer, layout], (_value, _previous, cleanup) => {
	if (!panel.value || !footer.value) return;
	const measure = () => {
		footerHeight.value = footer.value?.getBoundingClientRect().height ?? 180;
		const card = panel.value?.querySelector<HTMLElement>('.rp-wall-side-card');
		if (card) cardHeight.value = card.getBoundingClientRect().height;
	};
	const observer = new ResizeObserver(measure); observer.observe(footer.value);
	for (const card of panel.value.querySelectorAll('.rp-wall-side-card')) observer.observe(card);
	measure(); cleanup(() => observer.disconnect());
}, { flush: 'post' });
let opener: HTMLElement | null = null;
watch(control.target, async (id, previous) => {
	if (id) { opener = document.activeElement instanceof HTMLElement ? document.activeElement : null; await nextTick(); if (control.target.value === id) panel.value?.querySelector<HTMLInputElement>(`[name="wall-side-${control.initialFace.value}"]`)?.focus(); }
	else if (previous) { const focused = panel.value?.contains(document.activeElement); await nextTick(); if (focused && !dialogs.current) (opener?.isConnected ? opener : anchor.value?.closest<HTMLElement>('.rp-plan-canvas'))?.focus(); }
}, { flush: 'pre' });
async function submit(): Promise<void> {
	if (invalid.value) { panel.value?.querySelector<HTMLInputElement>('input')?.focus(); return; }
	await control.apply();
}
function key(event: KeyboardEvent): void {
	if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
	else nativeSubmitKey(event);
}
function cancel(): void { if (!control.busy.value) control.close(); }
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
			:class="{ 'is-face-adjust': layout }"
			:style="panelStyle"
			:aria-labelledby="titleId"
			:aria-busy="isBusy"
			@submit.prevent="submit"
			@keydown="key"
		>
			<header v-if="control.mode.value === 'entry'">
				<h3 :id="titleId">
					{{ title }}
				</h3>
				<p :id="hintId">
					{{ tr('editor.wall-side.direction', { a: 'A', b: 'B' }) }}
				</p>
			</header>
			<svg
				v-if="layout"
				class="rp-wall-side-tethers"
				aria-hidden="true"
			>
				<g
					v-for="item in layout"
					:key="item.side"
				>
					<line
						:x1="item.face.x"
						:y1="item.face.y"
						:x2="item.tether.x"
						:y2="item.tether.y"
					/>
					<circle
						:cx="item.face.x"
						:cy="item.face.y"
						r="3"
					/>
				</g>
			</svg>
			<div
				v-for="item in fields"
				:key="item.side"
				:class="{ 'rp-wall-side-card': layout }"
				:style="item.style"
			>
				<WallSideField
					:side="item.side"
					:value="control.text.value[item.side]"
					:paused="control.paused.value"
					:invalid="invalid"
					:described-by="descriptionIds"
					:steps="control.mode.value === 'adjust'"
					:decrease="control.canIncrement(item.side, -1)"
					:increase="control.canIncrement(item.side, 1)"
					@update="control.update(item.side, $event)"
					@focus="control.focus"
					@hover="control.hover"
					@step="control.increment(item.side, $event)"
				/>
			</div>
			<div
				ref="footer"
				class="rp-wall-side-summary"
				:style="summaryStyle"
			>
				<template v-if="control.mode.value === 'adjust'">
					<h3 :id="titleId">
						{{ title }}
					</h3>
					<p :id="hintId">
						{{ tr('editor.wall-side.direction', { a: 'A', b: 'B' }) }}
					</p>
				</template>
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
					{{ status }}
				</p>
				<div class="rp-wall-thickness-footer">
					<button
						type="button"
						:aria-disabled="control.busy.value"
						@click="cancel"
					>
						{{ tr('dialog.cancel') }}
					</button>
					<button
						type="submit"
						class="mod-cta"
						:aria-disabled="cannotApply"
					>
						{{ tr('editor.wall-thickness.apply') }}
					</button>
				</div>
			</div>
		</form>
	</div>
</template>
