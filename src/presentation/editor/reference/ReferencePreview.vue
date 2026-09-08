<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { ReferenceAppearance } from '../../../domain/plan/ReferenceAppearance';
import { referencePoint } from '../../../domain/plan/ReferenceAppearance';
import type { BackgroundRenderModel } from '../layers/background/BackgroundRenderModel';
import { previewTransform } from './referenceSetup';
import { referenceSourcePoint, zoomReference, type ReferenceViewport } from './referenceViewport';
import { tr } from '../../i18n/strings';
const props = defineProps<{ raster: Extract<BackgroundRenderModel, { kind: 'raster' }>; appearance: ReferenceAppearance; points: readonly (Point | null)[]; measuring: boolean; onThemeChange?: (listener: () => void) => () => void }>();
const emit = defineEmits<{ point: [point: Point] }>();
const canvas = ref<HTMLCanvasElement | null>(null), size = ref({ width: 400, height: 220 });
const view = ref<ReferenceViewport>(previewTransform(props.appearance)), panMode = ref(false), space = ref(false), dragging = ref(false);
const hintId = useId();
const zoomPercent = computed(() => Math.round(view.value.scale / previewTransform(props.appearance, size.value).scale * 100));
let observer: ResizeObserver | undefined, unsubscribe: (() => void) | undefined;
let gesture: { id: number; start: Point; view: ReferenceViewport; moved: boolean; navigationOnly: boolean } | null = null;
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
	const styles = getComputedStyle(element);
	context.strokeStyle = styles.color; context.lineWidth = 2;
	context.beginPath();
	let previous: Point | null = null;
	props.points.forEach((point, index) => {
		if (!point) return;
		const p = referencePoint(point, props.appearance, view.value.scale), x = p.x + view.value.x, y = p.y + view.value.y;
		if (previous) context.lineTo(x, y); else context.moveTo(x, y);
		previous = point;
		context.fillStyle = styles.color; context.fillRect(x - 4, y - 4, 8, 8);
		if (x >= 0 && x <= size.value.width && y >= 0 && y <= size.value.height) {
			const labelX = Math.max(2, Math.min(size.value.width - 20, x + 6)), labelY = Math.max(2, Math.min(size.value.height - 20, y - 18));
			context.fillStyle = styles.backgroundColor; context.fillRect(labelX, labelY, 18, 18);
			context.fillStyle = getComputedStyle(element.parentElement as HTMLElement).color;
			context.font = `12px ${styles.fontFamily || 'sans-serif'}`; context.fillText(index === 0 ? 'A' : 'B', labelX + 4, labelY + 13);
		}
	});
	context.stroke();
}
function fit(): void { view.value = previewTransform(props.appearance, size.value); }
function measure(): void {
	const rect = canvas.value?.getBoundingClientRect();
	if (!rect || rect.width <= 0 || rect.height <= 0) return;
	const next = { width: canvas.value?.clientWidth || rect.width, height: canvas.value?.clientHeight || rect.height };
	if (next.width === size.value.width && next.height === size.value.height) return;
	end();
	view.value = { ...view.value, x: view.value.x + (next.width - size.value.width) / 2, y: view.value.y + (next.height - size.value.height) / 2 };
	size.value = next; draw();
}
function screenPoint(event: MouseEvent): Point | null {
	const rect = canvas.value?.getBoundingClientRect();
	return rect && rect.width > 0 && rect.height > 0 ? { x: (event.clientX - rect.left) * size.value.width / rect.width, y: (event.clientY - rect.top) * size.value.height / rect.height } : null;
}
function zoom(factor: number, anchor = { x: size.value.width / 2, y: size.value.height / 2 }): void {
	view.value = zoomReference(view.value, anchor, factor, previewTransform(props.appearance, size.value).scale);
}
function wheel(event: WheelEvent): void {
	const point = screenPoint(event);
	if (point && !gesture) zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.0025), point);
}
function pick(event: MouseEvent): void {
	if (suppressClick) { suppressClick = false; return; }
	if (!props.measuring || panMode.value || space.value) return;
	const screen = screenPoint(event);
	if (!screen || screen.x < 0 || screen.x > size.value.width || screen.y < 0 || screen.y > size.value.height) return;
	const point = referenceSourcePoint(screen, view.value, props.appearance);
	if (point) emit('point', point);
}
function start(event: PointerEvent): void {
	if (gesture || (event.button !== 0 && event.button !== 1)) return;
	const point = screenPoint(event);
	if (!point) return;
	suppressClick = false;
	gesture = { id: event.pointerId, start: point, view: view.value, moved: false, navigationOnly: event.button === 1 || panMode.value || space.value || !props.measuring };
	canvas.value?.setPointerCapture?.(event.pointerId);
	if (event.button === 1) event.preventDefault();
}
function move(event: PointerEvent): void {
	if (!gesture || gesture.id !== event.pointerId) return;
	const point = screenPoint(event);
	if (!point) return;
	const dx = point.x - gesture.start.x, dy = point.y - gesture.start.y;
	if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
	gesture.moved = true; dragging.value = true;
	view.value = { ...gesture.view, x: gesture.view.x + dx, y: gesture.view.y + dy };
}
function end(event?: PointerEvent): void {
	if (gesture && event && gesture.id !== event.pointerId) return;
	const ended = gesture;
	gesture = null; dragging.value = false;
	if (!ended) return;
	suppressClick = !event || ended.moved || ended.navigationOnly;
	if (canvas.value?.hasPointerCapture?.(ended.id)) canvas.value.releasePointerCapture(ended.id);
}
const panKeys: Readonly<Record<string, Point>> = { arrowleft: { x: 1, y: 0 }, arrowright: { x: -1, y: 0 }, arrowup: { x: 0, y: 1 }, arrowdown: { x: 0, y: -1 } };

function keydown(event: KeyboardEvent): void {
	if (event.altKey || event.ctrlKey || event.metaKey) return;
	const key = event.key.toLowerCase();
	if (key === ' ') space.value = true;
	else if (key === 'f') fit();
	else if (key === '+' || key === '=') zoom(1.25);
	else if (key === '-') zoom(1 / 1.25);
	else if (panKeys[key]) {
		const distance = event.shiftKey ? 80 : 32;
		view.value = { ...view.value, x: view.value.x + panKeys[key].x * distance, y: view.value.y + panKeys[key].y * distance };
	} else return;
	event.preventDefault(); event.stopPropagation();
}
function keyup(event: KeyboardEvent): void { if (event.key === ' ') { space.value = false; event.preventDefault(); event.stopPropagation(); } }
function blur(): void { space.value = false; end(); }
onMounted(() => { measure(); fit(); draw(); observer = new ResizeObserver(measure); observer.observe(canvas.value as HTMLCanvasElement); unsubscribe = props.onThemeChange?.(draw); });
onBeforeUnmount(() => { observer?.disconnect(); unsubscribe?.(); end(); });
watch(view, draw);
watch(() => props.measuring, measuring => { end(); if (measuring) panMode.value = false; });
watch(() => [props.raster, props.appearance.crop.x, props.appearance.crop.y, props.appearance.crop.width, props.appearance.crop.height, props.appearance.rotation], fit);
watch(() => [props.appearance.opacity, props.points], draw, { deep: true });
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
			:class="{ 'is-panning': dragging, 'is-navigation': panMode || space || !measuring }"
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
			{{ tr(measuring && !panMode && !space ? 'editor.reference.gestures-measure' : 'editor.reference.gestures') }}
		</p>
	</div>
</template>
