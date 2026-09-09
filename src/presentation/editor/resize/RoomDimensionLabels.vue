<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useEditorStore } from '../../stores/EditorStore';
import { useProjectStore } from '../../stores/ProjectStore';
import { useSelectionStore } from '../selection/selection-store';
import { useRenovationSession } from '../renovation/renovationSession';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';
import { dimensionTexts, roomDimensions, type DimensionsText } from './roomDimensions';
import { tr } from '../../i18n/strings';
import InlineRoomDimension from './InlineRoomDimension.vue';
import DraftRoomDimensions from './DraftRoomDimensions.vue';
import RoomEdgeMeasurements from './RoomEdgeMeasurements.vue';
import { roomSketchPoints } from './roomEdgeMeasurements';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useWorkspaceStore } from '../../stores/WorkspaceStore';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import { useDimensionObstacles, type DimensionObstacleLayout } from './useDimensionObstacles';
import type { PlanGeometryDocument } from '../../../application/ports/PlanGeometrySidecar';

const props = defineProps<{ preview?: PlanGeometryDocument | null }>();
const emit = defineEmits<{ obstacles: [layout: DimensionObstacleLayout]; rotationObstacles: [bounds: readonly BoundingBox[]] }>();
const runtime = useEditorRuntime(), editor = useEditorStore(), project = useProjectStore(), selection = useSelectionStore(), session = useRenovationSession();
const root = ref<HTMLElement | null>(null), axes = ['width', 'depth'] as const;
const workspace = useWorkspaceStore();
useDimensionObstacles(root, () => editor.viewport, bounds => emit('obstacles', bounds), {
	publish: bounds => emit('rotationObstacles', bounds),
	invalidate: () => [editor.viewport, runtime.rotationActions.target.value, workspace.overlay, runtime.renderState.rotationInteraction !== null, session.mode],
});
const selected = computed(() => selection.selectedIds.length === 1 ? project.zones.get(selection.selectedIds[0]) : undefined);
const room = computed(() => selected.value?.zoneType === 'Room' ? selected.value : null);
const draft = runtime.roomDimension.draft;
const box = computed(() => {
	if (draft.value) return roomDimensions(runtime.renderState.previewPolygon ?? []) ?? draft.value.box;
	if (!room.value) return null;
	const geometry = props.preview?.objects.find(item => item.id === room.value?.id) ?? room.value;
	return roomDimensions(geometry.points, geometry.bulges);
});
const visible = computed(() => box.value !== null && (draft.value !== null || runtime.renderState.previewPolygon === null) && session.perspective !== 'review' && (workspace.layerVisibility.zone || draft.value !== null)
	&& (runtime.activeToolId.value === 'select' || runtime.activeToolId.value === 'edit-room-dimension'));
const measured = computed(() => {
	const tool = runtime.activeToolId.value;
	if (tool === 'draw-room') return { points: runtime.roomDraft.geometry?.points ?? [], closed: true, omitAxisControls: true };
	if (tool === 'draw-polygon') return { points: roomSketchPoints(runtime.renderState.polygonSketch), closed: false, omitAxisControls: false };
	const measuring = room.value ?? (draft.value ? project.zones.get(draft.value.id) : undefined);
	if (!measuring || !workspace.layerVisibility.zone || !['select', 'edit-room-dimension', 'edit-curves'].includes(tool ?? '')) return null;
	const geometry = props.preview?.objects.find(item => item.id === measuring.id) ?? measuring;
	return { points: runtime.renderState.previewPolygon ?? geometry.points, bulges: geometry.bulges, closed: true, omitAxisControls: visible.value };
});
const groupMeasurements = computed(() => selection.selectedIds.length < 2 || !workspace.layerVisibility.zone ? [] : selection.selectedIds.flatMap(id => {
	const zone = project.zones.get(id);
	if (zone?.zoneType !== 'Room') return [];
	return [props.preview?.objects.find(item => item.id === id) ?? zone];
}));
function anchor(axis: keyof DimensionsText, bounds: BoundingBox) {
	const point = worldToScreen({ x: axis === 'width' ? (bounds.min.x + bounds.max.x) / 2 : bounds.min.x,
		y: axis === 'width' ? bounds.min.y : (bounds.min.y + bounds.max.y) / 2 }, editor.viewport, STAGE_PIXELS);
	const editing = draft.value?.axis === axis;
	const top = Math.max(48, Math.min(editor.stageSize.height - (editing ? 250 : 88), point.y - (axis === 'width' ? 44 : 14)));
	return { left: Math.max(editing ? 124 : 40, Math.min(editor.stageSize.width - (editing ? 124 : 40), point.x - (axis === 'depth' ? 28 : 0))),
		top, maxHeight: Math.max(100, editor.stageSize.height - top - 88) };
}
function position(axis: keyof DimensionsText, bounds: BoundingBox) {
	const point = anchor(axis, bounds);
	return { left: `${point.left}px`, top: `${point.top}px`, '--rp-dimension-max-height': `${point.maxHeight}px` };
}
function guides(bounds: BoundingBox) {
	const min = worldToScreen(bounds.min, editor.viewport, STAGE_PIXELS), max = worldToScreen(bounds.max, editor.viewport, STAGE_PIXELS);
	return { width: { left: `${min.x}px`, top: `${anchor('width', bounds).top + 14}px`, width: `${max.x - min.x}px` },
		depth: { left: `${anchor('depth', bounds).left}px`, top: `${min.y}px`, height: `${max.y - min.y}px` } };
}
function open(axis: keyof DimensionsText): void { if (room.value) void runtime.roomDimension.open(room.value.id as ZoneId, axis); }
// Capture ownership before the inline form disappears; never steal focus from another region.
watch(draft, (next, previous) => {
	if (next || !previous || !root.value?.contains(root.value.ownerDocument.activeElement)) return;
	const element = root.value;
	void nextTick(async () => {
		await nextTick();
		if (!element.isConnected || selection.selectedIds[0] !== previous.id) return;
		const active = element.ownerDocument.activeElement;
		if (active !== element.ownerDocument.body && !element.contains(active)) return;
		element.querySelector<HTMLElement>(`[data-rp-dimension="${previous.axis}"]`)?.focus();
	});
}, { flush: 'sync' });
</script>

<template>
	<div
		ref="root"
		class="rp-dimension-labels"
	>
		<DraftRoomDimensions />
		<RoomEdgeMeasurements
			v-if="measured"
			v-bind="measured"
		/>
		<RoomEdgeMeasurements
			v-for="geometry in groupMeasurements"
			:key="geometry.id"
			:points="geometry.points"
			:bulges="geometry.bulges"
			:closed="true"
			:omit-axis-controls="false"
		/>
		<template v-if="visible && box">
			<template v-if="draft === null">
				<span
					class="rp-dimension-guide rp-dimension-guide--width"
					:style="guides(box).width"
					aria-hidden="true"
				/>
				<span
					class="rp-dimension-guide rp-dimension-guide--depth"
					:style="guides(box).depth"
					aria-hidden="true"
				/>
			</template>
			<div
				v-for="axis in axes"
				:key="axis"
				class="rp-dimension-anchor"
				:style="position(axis, box)"
			>
				<InlineRoomDimension
					v-if="draft?.axis === axis"
					:draft="draft"
					:cancel="runtime.roomDimension.cancel"
				/>
				<button
					v-else
					type="button"
					class="rp-dimension-label"
					:data-rp-dimension="axis"
					:aria-disabled="runtime.resizeRoomBlocked.value || draft !== null"
					:aria-label="tr(axis === 'width' ? 'editor.dimension.edit-width' : 'editor.dimension.edit-depth', { value: dimensionTexts(box)[axis] })"
					@click="open(axis)"
				>
					{{ dimensionTexts(box)[axis] }} m
				</button>
			</div>
		</template>
	</div>
</template>
