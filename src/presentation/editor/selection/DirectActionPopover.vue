<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useEditorStore } from '../../stores/EditorStore';
import { useDirectActionContext } from './directActionContext';
import { usePlanningContext } from '../planning/planningContext';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';
import { formatMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
import type { RenovationMode } from '../renovation/renovationSession';
import type { ZoneId } from '../../../domain/zone/ZoneId';
import { useSaveStateStore } from '../save-state/save-state-store';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import HostIcon from '../../components/HostIcon.vue';
import DirectDetailOptions from './DirectDetailOptions.vue';

const runtime = useEditorRuntime(), editor = useEditorStore(), planning = usePlanningContext();
const saves = useSaveStateStore();
const { target, session } = useDirectActionContext();
const expanded = ref(false), opener = ref<HTMLButtonElement | null>(null), optionsId = useId();
const modes = computed(() => planning.context.commands.planning ? ['existing', 'planned', 'work', 'materials', 'costs', 'documents', 'photos', 'notes'] as const : ['existing', 'planned', 'work'] as const);
const visible = computed(() => target.value !== null && target.value.visible && session.perspective !== 'review' && runtime.activeToolId.value === 'select' && runtime.renderState.rotationDegrees === null
	&& (target.value.zone || target.value.wall || target.value.opening || session.perspective === 'plan'));
const blocked = computed(() => runtime.writesBlocked.value || saves.state === 'saving');
const detailBlocked = computed(() => blocked.value || runtime.renovation.blocked.value || (planning.context.commands.planning !== undefined && planning.blocked.value));
const editIcon = computed(() => target.value?.wall ? 'ruler' : 'pencil');
const editLabel = computed(() => tr(target.value?.wall ? 'editor.direct.edit-length' : 'editor.direct.edit-shape'));
const detailAction = computed(() => target.value?.roomId && runtime.renovation.available ? (target.value.wall ? 'change' : 'detail') : null);
function position(box: BoundingBox, zone: boolean) {
	const point = worldToScreen({ x: zone ? (box.min.x + box.max.x) / 2 : box.max.x, y: box.max.y }, editor.viewport, STAGE_PIXELS);
	return { left: `${Math.max(8, Math.min(editor.stageSize.width - 180, point.x + (zone ? -86 : 20)))}px`,
		top: `${Math.max(60, Math.min(editor.stageSize.height - 170, point.y + (zone ? 18 : -24)))}px` };
}
const length = computed(() => {
	const wall = target.value?.wall;
	return wall ? formatMetres(Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y)) : null;
});
watch(() => target.value?.id, () => { expanded.value = false; });
function edit(): void {
	const item = target.value;
	if (!item || blocked.value) return;
	if (item.zone) { void runtime.outlineEdit.editOutline(item.zone.id as ZoneId); return; }
	if (item.wall || item.opening) { void runtime.structureActions.edit(item.id); return; }
	void runtime.elementActions.edit(item.id);
}
async function detail(mode: Exclude<RenovationMode, 'overview'>): Promise<void> {
	const item = target.value;
	if (!item?.roomId || detailBlocked.value) return;
	expanded.value = false;
	opener.value?.focus();
	runtime.renovation.focus(item.roomId, mode);
	if (mode === 'existing' || mode === 'planned' || mode === 'work') { await runtime.renovation.edit(mode, item.roomId); return; }
	await planning.edit(mode === 'materials' ? 'material' : mode === 'costs' ? 'cost' : 'evidence');
}
function escape(event: KeyboardEvent): void {
	if (!expanded.value) return;
	event.stopPropagation();
	if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
	event.preventDefault(); expanded.value = false; opener.value?.focus();
}
</script>

<template>
	<div
		v-if="visible && target"
		class="rp-direct-actions"
		:class="{ 'rp-direct-actions--zone': target?.zone }"
		:style="position(target.box, Boolean(target.zone))"
		@keydown.esc="escape"
	>
		<button
			v-if="length !== null"
			type="button"
			class="rp-dimension-label rp-wall-dimension"
			data-rp-wall-length
			:aria-disabled="blocked"
			:aria-label="tr('editor.direct.length-value', { value: length })"
			@click="edit"
		>
			{{ length }} m
		</button>
		<div class="rp-direct-actions__buttons">
			<button
				type="button"
				data-rp-canvas-edit
				:aria-disabled="blocked"
				@click="edit"
			>
				<HostIcon :name="editIcon" />{{ editLabel }}
			</button>
			<button
				v-if="detailAction === 'change'"
				type="button"
				data-rp-canvas-change
				:aria-disabled="detailBlocked"
				@click="detail('planned')"
			>
				<HostIcon name="pencil" />{{ tr('editor.direct.mark-change') }}
			</button>
			<button
				v-else-if="detailAction === 'detail'"
				ref="opener"
				type="button"
				data-rp-canvas-detail
				:aria-expanded="expanded"
				:aria-controls="optionsId"
				:aria-disabled="detailBlocked"
				@click="!detailBlocked && (expanded = !expanded)"
			>
				<HostIcon name="grid-2x-2" />{{ tr('editor.direct.add-detail') }}
			</button>
		</div>
		<div
			v-if="expanded"
			:id="optionsId"
			class="rp-direct-actions__details"
			:aria-label="tr('editor.direct.add-detail')"
			role="group"
		>
			<DirectDetailOptions
				:modes="modes"
				:blocked="detailBlocked"
				@select="detail"
			/>
		</div>
	</div>
</template>
