<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { ReferenceAppearance } from '../../../domain/plan/ReferenceAppearance';
import { referencePoint } from '../../../domain/plan/ReferenceAppearance';
import type { BackgroundRenderModel } from '../layers/background/BackgroundRenderModel';
import { previewTransform } from './referenceSetup';
import { tr } from '../../i18n/strings';
const props = defineProps<{ raster: Extract<BackgroundRenderModel, { kind: 'raster' }>; appearance: ReferenceAppearance; points: readonly Point[]; measuring: boolean }>();
const emit = defineEmits<{ point: [point: Point] }>();
const canvas = ref<HTMLCanvasElement | null>(null);
function draw(): void {
	const context = canvas.value?.getContext('2d');
	if (!context) return;
	const fit = previewTransform(props.appearance);
	context.clearRect(0, 0, 400, 220);
	context.save();
	context.translate(fit.x, fit.y); context.scale(fit.scale, fit.scale);
	context.rotate(props.appearance.rotation * Math.PI / 180);
	context.globalAlpha = props.appearance.opacity;
	const c = props.appearance.crop;
	context.drawImage(props.raster.image, c.x, c.y, c.width, c.height, 0, 0, c.width, c.height);
	context.restore();
	context.strokeStyle = '#d52255'; context.fillStyle = '#d52255'; context.lineWidth = 2;
	context.beginPath();
	props.points.forEach((point, i) => {
		const p = referencePoint(point, props.appearance, fit.scale), x = p.x + fit.x, y = p.y + fit.y;
		if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
		context.fillRect(x - 3, y - 3, 6, 6);
	});
	context.stroke();
}
function pick(event: MouseEvent): void {
	if (!props.measuring || !canvas.value) return;
	const rect = canvas.value.getBoundingClientRect(), fit = previewTransform(props.appearance);
	const x = ((event.clientX - rect.left) * 400 / rect.width - fit.x) / fit.scale;
	const y = ((event.clientY - rect.top) * 220 / rect.height - fit.y) / fit.scale;
	const a = -props.appearance.rotation * Math.PI / 180, c = props.appearance.crop;
	const point = { x: x * Math.cos(a) - y * Math.sin(a) + c.x, y: x * Math.sin(a) + y * Math.cos(a) + c.y };
	if (point.x >= c.x && point.x <= c.x + c.width && point.y >= c.y && point.y <= c.y + c.height) emit('point', point);
}
onMounted(draw);
watch(() => [props.raster, props.appearance, props.points], draw, { deep: true });
</script>
<template>
	<canvas
		ref="canvas"
		width="400"
		height="220"
		class="rp-reference-preview"
		role="img"
		:aria-label="tr('editor.reference.preview')"
		@click="pick"
	/>
</template>
