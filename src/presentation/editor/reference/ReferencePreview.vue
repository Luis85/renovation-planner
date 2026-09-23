<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { ReferenceAppearance } from '../../../domain/plan/ReferenceAppearance';
import { referencePoint } from '../../../domain/plan/ReferenceAppearance';
import type { BackgroundRenderModel } from '../layers/background/BackgroundRenderModel';
import { previewTransform } from './referenceSetup';
import { dragRotation, formatDegrees, nudgeRotation, referenceScreenCentre, referenceSourcePoint, rotationHandlePoint, zoomReference, type ReferenceViewport } from './referenceViewport';
import { currentLanguage, tr } from '../../i18n/strings';
const props = defineProps<{ raster: Extract<BackgroundRenderModel, { kind: 'raster' }>; appearance: ReferenceAppearance; points: readonly (Point | null)[]; measuring: boolean; rotatable?: boolean; onThemeChange?: (listener: () => void) => () => void }>();
const emit = defineEmits<{ point: [point: Point]; rotation: [degrees: number] }>();
const canvas = ref<HTMLCanvasElement | null>(null), size = ref({ width: 400, height: 220 });
const view = ref<ReferenceViewport>(previewTransform(props.appearance)), panMode = ref(false), space = ref(false), dragging = ref(false), rotating = ref(false), overHandle = ref(false), nudging = ref(false);
// The scale as of the last `fit()`: the readout and zoom limits hold still through a rotation. `atFit` until the user zooms or pans.
const fitScale = ref(view.value.scale), announcement = ref('');
let atFit = true;
const hintId = useId();
const hint = computed(() => props.rotatable ? 'editor.reference.gestures-rotate' : props.measuring && !panMode.value && !space.value ? 'editor.reference.gestures-measure' : 'editor.reference.gestures');
const zoomPercent = computed(() => Math.round(view.value.scale / fitScale.value * 100));
let observer: ResizeObserver | undefined, unsubscribe: (() => void) | undefined;
let gesture: { id: number; start: Point; view: ReferenceViewport; moved: boolean; navigationOnly: boolean; rotate?: { rotation: number; from: Point; last?: number } } | null = null;
let suppressClick = false;
function draw(): void {
	const element = canvas.value, context = element?.getContext('2d');
	if (!element || !context) return;
	const ratio = window.devicePixelRatio || 1;
	const width = Math.round(size.value.width * ratio), height = Math.round(size.value.height * ratio);
	if (element.width !== width) element.width = width;
	if (element.height !== height) element.height = height;
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	context.clearRect(0, 0, size.value.width, size.value.height);
	context.save();
	context.translate(view.value.x, view.value.y); context.scale(view.value.scale, view.value.scale);
	context.rotate(props.appearance.rotation * Math.PI / 180);
	context.globalAlpha = props.appearance.opacity;
	const crop = props.appearance.crop;
	context.drawImage(props.raster.image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
	context.restore();
	const styles = getComputedStyle(element), ink = { accent: styles.color, surface: styles.backgroundColor, text: getComputedStyle(element.parentElement as HTMLElement).color };
	context.font = `12px ${styles.fontFamily || 'sans-serif'}`;
	context.strokeStyle = ink.accent; context.lineWidth = 2;
	context.beginPath();
	let previous: Point | null = null;
	props.points.forEach((point, index) => {
		if (!point) return;
		const p = referencePoint(point, props.appearance, view.value.scale), x = p.x + view.value.x, y = p.y + view.value.y;
		if (previous) context.lineTo(x, y); else context.moveTo(x, y);
		previous = point;
		context.fillStyle = ink.accent; context.fillRect(x - 4, y - 4, 8, 8);
		if (x >= 0 && x <= size.value.width && y >= 0 && y <= size.value.height) drawLabel(context, ink, index === 0 ? 'A' : 'B', { x: x + 6, y: y - 18 });
	});
	context.stroke();
	if (props.rotatable) drawHandle(context, ink);
}
type Ink = { accent: string; surface: string; text: string };
/** A boxed label at `at`, pulled back inside the canvas. */
function drawLabel(context: CanvasRenderingContext2D, ink: Ink, text: string, at: Point, width = 18): void {
	const left = Math.max(2, Math.min(size.value.width - width - 2, at.x)), top = Math.max(2, Math.min(size.value.height - 20, at.y));
	context.fillStyle = ink.surface; context.fillRect(left, top, width, 18);
	context.fillStyle = ink.text; context.fillText(text, left + 4, top + 13);
}
/** The knob on its stem: outlined at rest, larger and filled while hovered or dragged. While rotating, centre guides and the angle. */
function drawHandle(context: CanvasRenderingContext2D, ink: Ink): void {
	const { centre, knob } = handle(), active = overHandle.value || rotating.value;
	context.strokeStyle = ink.accent; context.fillStyle = active ? ink.accent : ink.surface; context.lineWidth = 1;
	context.beginPath();
	if (rotating.value) {
		context.moveTo(0, centre.y); context.lineTo(size.value.width, centre.y);
		context.moveTo(centre.x, 0); context.lineTo(centre.x, size.value.height);
		context.stroke(); context.beginPath();
	}
	context.lineWidth = 2; context.moveTo(centre.x, centre.y); context.lineTo(knob.x, knob.y);
	context.stroke();
	context.beginPath(); context.arc(knob.x, knob.y, active ? 9 : 7, 0, 2 * Math.PI); context.fill();
	if (!active) context.stroke();
	if (!rotating.value && !nudging.value) return;
	const angle = formatDegrees(props.appearance.rotation, currentLanguage());
	drawLabel(context, ink, angle, { x: knob.x + 12, y: knob.y - 9 }, context.measureText(angle).width + 8);
}
function handle(): { centre: Point; knob: Point } {
	const centre = referenceScreenCentre(view.value, props.appearance);
	return { centre, knob: rotationHandlePoint(centre, props.appearance.rotation, Math.min(size.value.width, size.value.height) / 2 - 16) };
}
/** `point` relative to the image's live on-screen centre, which a rotation's refit moves. */
function fromCentre(point: Point): Point {
	const centre = referenceScreenCentre(view.value, props.appearance);
	return { x: point.x - centre.x, y: point.y - centre.y };
}
function onHandle(point: Point): boolean {
	const { knob } = handle();
	return props.rotatable && !panMode.value && !space.value && Math.hypot(point.x - knob.x, point.y - knob.y) <= 12;
}
function fit(): void { view.value = previewTransform(props.appearance, size.value); fitScale.value = view.value.scale; atFit = true; }
/** After a rotation change: keep the zoom and shift the view so the image's on-screen centre stays put. */
function keepCentre(previousRotation: number): void {
	const before = referenceScreenCentre(view.value, { ...props.appearance, rotation: previousRotation }), after = referenceScreenCentre(view.value, props.appearance);
	view.value = { ...view.value, x: view.value.x + before.x - after.x, y: view.value.y + before.y - after.y };
}
function measure(): void {
	const rect = canvas.value?.getBoundingClientRect();
	if (!rect || rect.width <= 0 || rect.height <= 0) return;
	const next = { width: canvas.value?.clientWidth || rect.width, height: canvas.value?.clientHeight || rect.height };
	if (next.width === size.value.width && next.height === size.value.height) return;
	end();
	view.value = { ...view.value, x: view.value.x + (next.width - size.value.width) / 2, y: view.value.y + (next.height - size.value.height) / 2 };
	size.value = next; draw();
}
function previewPointerPoint(event: MouseEvent): Point | null {
	const rect = canvas.value?.getBoundingClientRect();
	return rect && rect.width > 0 && rect.height > 0 ? { x: (event.clientX - rect.left) * size.value.width / rect.width, y: (event.clientY - rect.top) * size.value.height / rect.height } : null;
}
function zoom(factor: number, anchor = { x: size.value.width / 2, y: size.value.height / 2 }): void {
	atFit = false; view.value = zoomReference(view.value, anchor, factor, fitScale.value);
}
function wheel(event: WheelEvent): void {
	const point = previewPointerPoint(event);
	if (point && !gesture) zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.0025), point);
}
function pick(event: MouseEvent): void {
	if (suppressClick) { suppressClick = false; return; }
	if (!props.measuring || panMode.value || space.value) return;
	const screen = previewPointerPoint(event);
	if (!screen || screen.x < 0 || screen.x > size.value.width || screen.y < 0 || screen.y > size.value.height) return;
	const point = referenceSourcePoint(screen, view.value, props.appearance);
	if (point) emit('point', point);
}
function start(event: PointerEvent): void {
	if (gesture || (event.button !== 0 && event.button !== 1)) return;
	const point = previewPointerPoint(event);
	if (!point) return;
	suppressClick = false;
	rotating.value = event.button === 0 && onHandle(point);
	gesture = { id: event.pointerId, start: point, view: view.value, moved: false, navigationOnly: event.button === 1 || panMode.value || space.value || !props.measuring, rotate: rotating.value ? { rotation: props.appearance.rotation, from: fromCentre(point) } : undefined };
	canvas.value?.setPointerCapture?.(event.pointerId);
	if (event.button === 1) event.preventDefault();
}
function move(event: PointerEvent): void {
	const point = previewPointerPoint(event);
	if (!gesture) { overHandle.value = !!point && onHandle(point); return; }
	if (gesture.id !== event.pointerId || !point) return;
	if (gesture.rotate) { gesture.moved = true; gesture.rotate.last = dragRotation(gesture.rotate.rotation, gesture.rotate.from, fromCentre(point), event.shiftKey); emit('rotation', gesture.rotate.last); return; }
	const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
	if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
	gesture.moved = true; dragging.value = true; atFit = false;
	view.value = { ...gesture.view, x: gesture.view.x + dx, y: gesture.view.y + dy };
}
function end(event?: PointerEvent): void {
	if (gesture && event && gesture.id !== event.pointerId) return;
	const ended = gesture;
	gesture = null; dragging.value = false; rotating.value = false;
	if (!ended) return;
	suppressClick = !event || ended.moved || ended.navigationOnly;
	if (canvas.value?.hasPointerCapture?.(ended.id)) canvas.value.releasePointerCapture(ended.id);
	if (ended.rotate?.last !== undefined) announce(ended.rotate.last);
}
/** Tells assistive tech the angle once a drag ends or a nudge lands, never per pointermove. */
function announce(degrees: number): void { announcement.value = tr('editor.reference.rotation-announce', { angle: formatDegrees(degrees, currentLanguage()) }); }
const rotateKeys: Readonly<Record<string, number>> = { '[': -1, ']': 1, '{': -1, '}': 1 };
function altGraph(event: KeyboardEvent): boolean { return (event.ctrlKey && event.altKey) || event.getModifierState('AltGraph'); }
const panKeys: Readonly<Record<string, Point>> = { arrowleft: { x: 1, y: 0 }, arrowright: { x: -1, y: 0 }, arrowup: { x: 0, y: 1 }, arrowdown: { x: 0, y: -1 } };

/** `[`/`]` nudge rotation. AltGr arrives as Ctrl+Alt (or as AltGraph), and it is how they are typed on e.g. a German layout. */
function rotateKey(event: KeyboardEvent): boolean {
	if (!props.rotatable || !rotateKeys[event.key] || event.metaKey || ((event.altKey || event.ctrlKey) && !altGraph(event))) return false;
	const rotation = nudgeRotation(props.appearance.rotation, rotateKeys[event.key] * (event.shiftKey ? 0.1 : 1));
	nudging.value = true; emit('rotation', rotation); announce(rotation);
	return true;
}
function keydown(event: KeyboardEvent): void {
	if (rotateKey(event)) { event.preventDefault(); event.stopPropagation(); return; }
	if (event.altKey || event.ctrlKey || event.metaKey) return;
	const key = event.key.toLowerCase();
	if (key === ' ') space.value = true;
	else if (key === 'f') fit();
	else if (key === '+' || key === '=') zoom(1.25);
	else if (key === '-') zoom(1 / 1.25);
	else if (panKeys[key]) {
		const distance = event.shiftKey ? 80 : 32;
		atFit = false; view.value = { ...view.value, x: view.value.x + panKeys[key].x * distance, y: view.value.y + panKeys[key].y * distance };
	} else return;
	event.preventDefault(); event.stopPropagation();
}
function keyup(event: KeyboardEvent): void {
	if (rotateKeys[event.key]) nudging.value = false;
	if (event.key === ' ') { space.value = false; event.preventDefault(); event.stopPropagation(); }
}
function blur(): void { space.value = false; nudging.value = false; end(); }
onMounted(() => { measure(); fit(); draw(); observer = new ResizeObserver(measure); observer.observe(canvas.value as HTMLCanvasElement); unsubscribe = props.onThemeChange?.(draw); });
onBeforeUnmount(() => { observer?.disconnect(); unsubscribe?.(); end(); });
watch(view, draw);
watch(() => props.measuring, measuring => { end(); if (measuring) panMode.value = false; });
// A rotation at fit refits, so a turned scan never spills past the corners. One watcher, so a change of source or crop always refits even when the rotation moved in the same tick.
watch(() => [props.raster, props.appearance.crop.x, props.appearance.crop.y, props.appearance.crop.width, props.appearance.crop.height, props.appearance.rotation] as const, (next, previous) => {
	if (!atFit && next.slice(0, 5).every((value, index) => value === previous[index])) keepCentre(previous[5]); else fit();
});
watch(() => props.rotatable, () => { end(); overHandle.value = false; });
watch(() => [props.appearance.opacity, props.points, props.rotatable, rotating.value, overHandle.value, nudging.value], draw, { deep: true });
</script>
<template>
	<div class="rp-reference-viewport">
		<div
			class="rp-reference-viewport__tools"
			role="group"
			:aria-label="tr('editor.reference.viewport')"
		>
			<button
				type="button"
				data-rp-reference-view="zoom-out"
				@click="zoom(1 / 1.25)"
			>
				{{ tr('editor.reference.zoom-out') }}
			</button>
			<output :aria-label="tr('editor.zoom')">{{ zoomPercent }}%</output>
			<button
				type="button"
				data-rp-reference-view="zoom-in"
				@click="zoom(1.25)"
			>
				{{ tr('editor.reference.zoom-in') }}
			</button>
			<button
				type="button"
				data-rp-reference-view="fit"
				@click="fit"
			>
				{{ tr('editor.reference.fit') }}
			</button>
			<button
				type="button"
				data-rp-reference-view="pan"
				:aria-pressed="panMode"
				@click="panMode = !panMode"
			>
				{{ tr('editor.reference.pan') }}
			</button>
		</div>
		<canvas
			ref="canvas"
			width="400"
			height="220"
			class="rp-reference-preview"
			:class="{ 'is-panning': dragging, 'is-navigation': panMode || space || !measuring, 'is-over-handle': overHandle, 'is-rotating': rotating }"
			role="img"
			tabindex="0"
			:aria-label="tr('editor.reference.preview')"
			:aria-describedby="hintId"
			@click="pick"
			@pointerdown="start"
			@pointermove="move"
			@pointerup="end"
			@pointercancel="end()"
			@lostpointercapture="end()"
			@wheel.prevent="wheel"
			@keydown="keydown"
			@keyup="keyup"
			@blur="blur"
		/>
		<p
			:id="hintId"
			class="rp-reference-viewport__hint"
		>
			{{ tr(hint) }}
		</p>
		<p
			class="rp-visually-hidden"
			aria-live="polite"
		>
			{{ announcement }}
		</p>
	</div>
</template>
