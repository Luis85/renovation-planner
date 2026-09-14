<script setup lang="ts">
import { computed, ref } from 'vue';
import { useEditorRuntime } from '../runtime';
import { useEditorStore } from '../../stores/EditorStore';
import { useDirectActionContext } from './directActionContext';
import { usePlanningContext } from '../planning/planningContext';
import { STAGE_PIXELS, worldToScreen } from '../viewport/Viewport';
import { formatMetres } from '../shell/formatLength';
import { tr } from '../../i18n/strings';
import { useSaveStateStore } from '../save-state/save-state-store';
import type { BoundingBox } from '../../../core/geometry/BoundingBox';
import HostIcon from '../../components/HostIcon.vue';
import { useTaskbarClearance } from '../shell/useTaskbarClearance';

const runtime = useEditorRuntime(), editor = useEditorStore(), planning = usePlanningContext(), saves = useSaveStateStore();
const { target, session } = useDirectActionContext();
const root = ref<HTMLElement | null>(null), clearance = useTaskbarClearance(root, { includeContent: true });
const visible = computed(() => target.value?.wall && target.value.visible && session.perspective !== 'review' && runtime.activeToolId.value === 'select' && runtime.renderState.rotationDegrees === null);
const length = computed(() => { const wall = target.value?.wall; return wall ? formatMetres(Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y)) : ''; });
const showChange = computed(() => target.value?.roomId && runtime.renovation.available);
const blocked = computed(() => runtime.writesBlocked.value || saves.state === 'saving');
const geometryBlocked = computed(() => blocked.value || session.perspective !== 'plan');
const changeBlocked = computed(() => blocked.value || runtime.renovation.blocked.value || (planning.context.commands.planning !== undefined && planning.blocked.value));
function position(box: BoundingBox) {
	const point = worldToScreen(box.max, editor.viewport, STAGE_PIXELS);
	return { left: `${Math.max(8, Math.min(editor.stageSize.width - 180, point.x + 20))}px`,
		top: `${Math.max(60, Math.min(editor.stageSize.height - Math.max(170, clearance.value), point.y - 24))}px` };
}
function edit(): void { if (target.value && !geometryBlocked.value) void runtime.structureActions.edit(target.value.id); }
async function change(): Promise<void> {
	const item = target.value;
	if (!item?.roomId || changeBlocked.value) return;
	runtime.renovation.focus(item.roomId, 'planned');
	await runtime.renovation.edit('planned', item.roomId);
}
</script>

<template>
	<div
		v-if="visible && target"
		ref="root"
		class="rp-wall-canvas-actions"
		:style="position(target.box)"
	>
		<button
			type="button"
			class="rp-dimension-label rp-wall-dimension"
			data-rp-wall-length
			:aria-disabled="geometryBlocked"
			:aria-label="tr('editor.direct.length-value', { value: length })"
			@click="edit"
		>
			{{ length }} m
		</button>
		<div
			v-if="showChange"
			class="rp-wall-canvas-actions__change"
		>
			<button
				type="button"
				data-rp-canvas-change
				:aria-disabled="changeBlocked"
				@click="change"
			>
				<HostIcon name="pencil" />{{ tr('editor.direct.mark-change') }}
			</button>
		</div>
	</div>
</template>
