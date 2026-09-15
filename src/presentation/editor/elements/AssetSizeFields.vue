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
// Keyed on the drawn size's own VALUE, not on `frame`'s identity: an unrelated committed write
// elsewhere in the plan (e.g. `projectStore.hydrate()` re-reading the sidecar) gives `element` a
// new object reference with the same width/depth, which recomputed `frame` and refired an
// identity-keyed watch — overwriting typed-but-uncommitted text with the unchanged formatted
// value. This getter answers a primitive, so the watch fires only when the formatted size
// actually differs.
const sizeKey = computed(() => {
	const size = transformBoxSize(frame.value);
	return `${formatMetres(size.width)}|${formatMetres(size.depth)}`;
});
watch(sizeKey, showSize, { immediate: true });
const busy = computed(() => runtime.elementActions.blocked.value || runtime.elementActions.active.value);
function applySize(size: Dimensions): void {
	const resized = sizedTransformBox(frame.value, size);
	if (resized && !busy.value) void runtime.elementActions.resize(props.element.id, resized, props.element);
}
// Both fields show a 3-decimal-metre ROUND of the drawn size, so re-parsing an axis whose text
// the user never touched would silently write that rounding back (a drag can leave a sub-mm
// depth `formatMetres` only ever shows to the nearest millimetre). An axis whose text still
// equals its own formatted current value keeps the exact current millimetres instead of being
// reparsed; only when at least one axis actually changed is a write sent at all.
function commitSize(): void {
	const current = transformBoxSize(frame.value);
	const width = text.value.width === formatMetres(current.width) ? { ok: true as const, mm: current.width } : parseMetres(text.value.width);
	const depth = text.value.depth === formatMetres(current.depth) ? { ok: true as const, mm: current.depth } : parseMetres(text.value.depth);
	if (width.ok && depth.ok && (width.mm !== current.width || depth.mm !== current.depth)) applySize({ width: width.mm, depth: depth.mm });
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
