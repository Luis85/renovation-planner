<script setup lang="ts">
import { normalizePath } from 'obsidian';
import { nativeSubmitKey as keydown } from "../forms/nativeSubmitKey";
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch, type Ref } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { ConfigureReferenceInput, ReferenceBaseline } from '../../../application/commands/plan/ConfigurePlanReference';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { backgroundKindFor } from '../../../domain/plan/PlanBackgroundRef';
import { loadBackground, type BackgroundRenderModel, type BackgroundVault } from '../layers/background/BackgroundRenderModel';
import { prepareValid, setupMeasurement } from './referenceSetup';
import ReferencePreview from './ReferencePreview.vue';
import ReferenceReview from './ReferenceReview.vue';
import ReferencePrepare from './ReferencePrepare.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { notifyFault } from '../../notices/notify';
import { WRITE_BOUNDARY_CODES } from '../../../application/ports/versioning';

const props = defineProps<{ baseline: ReferenceBaseline; vault: BackgroundVault; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>;
	logger: Logger; fileChanges: (listener: (path: string) => void) => () => void; dispatch: (input: ConfigureReferenceInput) => Promise<DispatchResult> }>();
const emit = defineEmits<{ submit: [] }>();
const candidates = props.vault.getFiles?.().filter(file => backgroundKindFor(file.path) !== null).map(file => file.path) ?? [];
const previous = props.baseline.plan.entity;
const calibration = props.baseline.geometry.document.calibration;
const path = ref(previous.background?.path ?? ''), page = ref(previous.background?.page ?? 1), step = ref(1);
// ONE canonical spelling, normalized once: a vault event carries `TFile.path`, and comparing
// the raw text against it let a `/scan.png` draft miss its own file's change and persist a
// spelling `BackgroundLayer` would never match either (a Codex P2 on pull request #85).
const sourcePath = computed(() => normalizePath(path.value.trim()));
const raster = ref<Extract<BackgroundRenderModel, { kind: 'raster' }> | null>(null);
const submitting = ref(false);
useDialogFormBusy(submitting, props.busy);
const loading = ref(false), error = ref(''), conflict = ref(false), acknowledged = ref(false);
const appearance = reactive({ crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, opacity: 0.65, visible: true, locked: true });
const coordinates = reactive({ ax: '', ay: '', bx: '', by: '' });
const length = ref(calibration ? String(calibration.knownDistance / 1000) : '');
const heading = ref<HTMLElement | null>(null);
let alive = true, generation = 0, nextPoint = 0;
const kind = computed(() => backgroundKindFor(sourcePath.value));
const paused = computed(() => submitting.value || props.busy.value || props.blocked.value || conflict.value);
const points = computed(() => Object.values(coordinates).every(s => String(s).trim() !== '' && Number.isFinite(Number(s)))
	? [{ x: Number(coordinates.ax), y: Number(coordinates.ay) }, { x: Number(coordinates.bx), y: Number(coordinates.by) }] : []);
const prepared = computed(() => raster.value !== null && prepareValid(appearance, raster.value.width, raster.value.height));
const scale = computed(() => {
	const [a, b] = points.value, c = appearance.crop;
	if (!prepared.value || !a || !b || !raster.value || ![a, b].every(p => p.x >= c.x && p.x <= c.x + c.width && p.y >= c.y && p.y <= c.y + c.height)) return null;
	return setupMeasurement([a, b], length.value, appearance, raster.value.worldScale, calibration);
});
const reviewScale = computed(() => scale.value === null ? tr('editor.reference.invalid-scale') : tr('editor.reference.scale-summary', { scale: Number(scale.value.millimetresPerSourcePixel.toPrecision(6)).toLocaleString(), length: length.value }));
const needsConsent = computed(() => (props.baseline.geometry.document.objects.length > 0 || (props.baseline.geometry.document.structure?.walls.length ?? 0) > 0) && scale.value?.scaleCorrection !== 1);
watch(scale, value => { if (value !== null && step.value === 2) error.value = ''; });
const submitLabel = computed(() => tr(step.value === 3 ? 'editor.reference.finish' : step.value === 2 ? 'editor.reference.apply-scale' : 'editor.reference.continue'));
const stageLabel = computed(() => tr(step.value === 1 ? 'editor.reference.prepare' : step.value === 2 ? 'editor.reference.scale' : 'editor.reference.review'));
function invalidate(): void { generation++; raster.value = null; loading.value = false; }
watch([path, page], invalidate);
onBeforeUnmount(props.fileChanges(changed => { if (changed === sourcePath.value) { invalidate(); error.value = tr('editor.reference.source-changed'); } }));
onBeforeUnmount(() => { alive = false; invalidate(); });
function anotherDistance(): void { Object.assign(coordinates, { ax: '', ay: '', bx: '', by: '' }); length.value = ''; nextPoint = 0; acknowledged.value = false; }
function initialise(model: Extract<BackgroundRenderModel, { kind: 'raster' }>): void {
	const same = previous.background?.path === sourcePath.value && (previous.background.page ?? 1) === Number(page.value);
	Object.assign(appearance, same && previous.background?.appearance ? structuredClone(previous.background.appearance)
		: { crop: { x: 0, y: 0, width: model.width, height: model.height }, rotation: 0, opacity: 0.65, visible: true, locked: true });
	if (same && calibration) {
		const angle = -appearance.rotation * Math.PI / 180, worldScale = model.worldScale / calibration.pixelsPerWorldUnit;
		const invert = (p: Point) => ({ x: (p.x * Math.cos(angle) - p.y * Math.sin(angle)) / worldScale + appearance.crop.x,
			y: (p.x * Math.sin(angle) + p.y * Math.cos(angle)) / worldScale + appearance.crop.y });
		const a = invert(calibration.pointA), b = invert(calibration.pointB);
		Object.assign(coordinates, { ax: String(a.x), ay: String(a.y), bx: String(b.x), by: String(b.y) });
	} else anotherDistance();
}
async function load(): Promise<void> {
	if (paused.value || loading.value) return;
	error.value = '';
	if (kind.value === null) { error.value = tr('editor.reference.source-help'); return; }
	const token = ++generation;
	loading.value = true;
	let model: BackgroundRenderModel;
	try { model = await loadBackground({ path: sourcePath.value, kind: kind.value, page: Number(page.value) }, props.vault); }
	catch { model = { kind: 'unavailable', reason: 'unreadable' }; }
	if (!alive || token !== generation) return;
	loading.value = false;
	if (model.kind !== 'raster') { raster.value = null; error.value = tr(model.kind === 'unavailable' && model.reason === 'missing' ? 'editor.reference.missing' : 'editor.reference.unreadable'); return; }
	raster.value = model; initialise(model);
}

function pick(point: Point): void {
	if (paused.value) return;
	const pair = nextPoint++ % 2 === 0 ? ['ax', 'ay'] as const : ['bx', 'by'] as const;
	coordinates[pair[0]] = String(Math.round(point.x * 100) / 100); coordinates[pair[1]] = String(Math.round(point.y * 100) / 100);
}
async function go(next: number): Promise<void> {
	if (paused.value) return;
	step.value = next; error.value = ''; await nextTick(); heading.value?.focus();
}
async function commit(): Promise<void> {
	if (scale.value === null) return;
	const sourceKind = kind.value;
	if (sourceKind === null) return;
	submitting.value = true;
	try {
		const result = await props.dispatch({ background: { path: sourcePath.value, kind: sourceKind,
			...(sourceKind === 'pdf' ? { page: Number(page.value) } : {}), appearance: structuredClone(toRaw(appearance)) }, measurement: scale.value.measurement });
		if (!alive) return;
		if (result.ok) emit('submit');
		else { error.value = trError(result.error); conflict.value = WRITE_BOUNDARY_CODES.some(code => result.error.code.endsWith(`.${code}`)); }
	} catch (cause) { if (alive) { notifyFault(cause, props.logger, 'editor.reference.submit-failed'); error.value = tr('editor.reference.failed'); } }
	finally { submitting.value = false; }
}
async function submit(): Promise<void> {
	if (paused.value || loading.value) return;
	if (step.value === 1) { if (prepared.value) await go(2); else error.value = tr('editor.reference.invalid-prepare'); return; }
	if (scale.value === null) { error.value = tr('editor.reference.invalid-scale'); return; }
	if (step.value === 2) { await go(3); return; }
	if (needsConsent.value && !acknowledged.value) { error.value = tr('editor.reference.consent'); return; }
	await commit();
}

onMounted(() => { if (path.value) void load(); });
</script>
<template>
	<form
		class="rp-dialog-form rp-reference-setup"
		data-rp-form="reference"
		@submit.prevent="submit"
		@keydown="keydown"
	>
		<h3
			ref="heading"
			tabindex="-1"
			aria-live="polite"
		>
			{{ step }} / 3 · {{ stageLabel }}
		</h3>
		<p
			v-if="error"
			role="alert"
		>
			{{ error }}
		</p>
		<p
			v-if="paused"
			role="status"
		>
			{{ tr('editor.reference.paused') }}
		</p>
		<ReferencePrepare
			v-if="step === 1"
			v-model:path="path"
			v-model:page="page"
			v-model:rotation="appearance.rotation"
			v-model:crop="appearance.crop"
			:sources="candidates"
			:pdf="kind === 'pdf'"
			:paused="paused"
			:loading="loading"
			:has-raster="raster !== null"
			@load="load"
		/>
		<section v-if="step === 2">
			<p>{{ tr('editor.reference.measure-help') }}</p>
			<div class="rp-reference-grid">
				<label
					v-for="key in (['ax', 'ay', 'bx', 'by'] as const)"
					:key="key"
					class="rp-dialog-field"
				>{{ tr(`editor.reference.${key}`) }}<input
					v-model="coordinates[key]"
					:name="key"
					type="number"
					step="any"
					:readonly="paused"
				></label>
			</div>
			<label class="rp-dialog-field">{{ tr('editor.reference.length') }}<input
				v-model="length"
				name="length"
				type="text"
				inputmode="decimal"
				:readonly="paused"
			></label>
			<button
				type="button"
				:aria-disabled="paused"
				@click="!paused && anotherDistance()"
			>
				{{ tr('editor.reference.another') }}
			</button>
		</section>
		<ReferenceReview
			v-if="step === 3"
			v-model:opacity="appearance.opacity"
			v-model:visible="appearance.visible"
			v-model:locked="appearance.locked"
			v-model:acknowledged="acknowledged"
			:path="path"
			:page="kind === 'pdf' ? Number(page) : null"
			:rotation="appearance.rotation"
			:crop="appearance.crop"
			:scale-summary="reviewScale"
			:factor="Number(scale?.scaleCorrection?.toPrecision(6)).toLocaleString()"
			:needs-consent="needsConsent"
			:paused="paused"
		/>
		<ReferencePreview
			v-if="raster && prepared"
			:raster="raster"
			:appearance="appearance"
			:points="points"
			:measuring="step === 2 && !paused"
			@point="pick"
		/>
		<div class="rp-dialog-actions">
			<button
				v-if="step > 1"
				type="button"
				:aria-disabled="paused"
				@click="go(step - 1)"
			>
				{{ tr('editor.reference.back') }}
			</button>
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="paused || loading"
			>
				{{ submitLabel }}
			</button>
		</div>
	</form>
</template>
