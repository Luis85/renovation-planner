<script setup lang="ts">
/**
 * A placement's own width and depth (plan editor transform box design, Inspector): typed in metres and
 * applied about the placement's centre through the same resize write a handle drag takes, or reset to the
 * library's size. Its own component so every prop is non-null: the parent mounts it only for a placeable
 * shape in Plan.
 */
import { computed, ref, watch } from 'vue';
import type { AssetShape, Dimensions } from '../../../domain/asset/AssetShape';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { formatMetres, parseMetres } from '../shell/formatLength';
import { assetTransformBox, sizedTransformBox, transformBoxSize } from './transformBox';

const props = defineProps<{ element: SpatialElement; shape: AssetShape; library: Dimensions }>();
const runtime = useEditorRuntime();
const frame = computed(() => assetTransformBox(props.element, props.shape));
const text = ref({ width: '', depth: '' });
function showSize(): void {
	const size = transformBoxSize(frame.value);
	text.value = { width: formatMetres(size.width), depth: formatMetres(size.depth) };
}
watch(frame, showSize, { immediate: true });
const busy = computed(() => runtime.elementActions.blocked.value || runtime.elementActions.active.value);
function applySize(size: Dimensions): void {
	const resized = sizedTransformBox(frame.value, size);
	if (resized && !busy.value) void runtime.elementActions.resize(props.element.id, resized, props.element);
}
function commitSize(): void {
	const width = parseMetres(text.value.width), depth = parseMetres(text.value.depth);
	if (width.ok && depth.ok) applySize({ width: width.mm, depth: depth.mm });
	showSize();
}
</script>

<template>
	<div class="rp-dialog-actions">
		<label class="rp-dialog-field">{{ tr('editor.asset.width') }}<input
			v-model="text.width"
			name="asset-width"
			type="text"
			inputmode="decimal"
			:readonly="busy"
			:aria-disabled="busy"
			@change="commitSize"
		></label>
		<label class="rp-dialog-field">{{ tr('editor.asset.depth') }}<input
			v-model="text.depth"
			name="asset-depth"
			type="text"
			inputmode="decimal"
			:readonly="busy"
			:aria-disabled="busy"
			@change="commitSize"
		></label>
		<button
			v-if="element.size"
			type="button"
			data-rp-action="reset-asset-size"
			:aria-disabled="busy"
			@click="applySize(library)"
		>
			{{ tr('editor.asset.reset-size') }}
		</button>
	</div>
</template>
