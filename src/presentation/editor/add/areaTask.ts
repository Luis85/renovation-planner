import { computed, ref, watch, type Ref } from 'vue';
import type { ToolId } from '../tools/editor-tool';
import type { ToolManager } from '../tools/tool-manager';
import type { RenderState } from '../tools/render-state';
import { useSaveStateStore } from '../save-state/save-state-store';
import { areaOutline } from './areaOutline';
import type { RoomDraftStore } from './room-draft-store';
import { createAreaCornerInput } from './areaCornerInput';

/** Per-leaf task preferences and the button facade over the geometry tool's one completion. */
export function createAreaTask(deps: {
	toolManager: ToolManager;
	roomDraft: RoomDraftStore;
	defaultRoomName: () => string;
	activeToolId: Ref<ToolId | null>;
	renderState: RenderState;
	writesBlocked: Readonly<Ref<boolean>>;
	returnToSelect: () => void;
}) {
	const keepAddingAreas = ref(false);
	watch(deps.activeToolId, (next, previous) => {
		if (next === 'draw-polygon') deps.roomDraft.beginTask(deps.defaultRoomName());
		else if (previous === 'draw-polygon' && next !== 'draw-room') deps.roomDraft.reset();
	}, { flush: 'sync' });
	// Repetition belongs to this activation, never to a later task or another leaf.
	watch(deps.activeToolId, () => { keepAddingAreas.value = false; }, { flush: 'sync' });
	const onAreaCompleted = (): void => { if (!keepAddingAreas.value) deps.returnToSelect(); };
	const saveState = useSaveStateStore();
	// Both polygon tools share the same numeric buffer and completion gate. The legacy
	// Area facade names remain stable for callers; semantic identity belongs to the tool.
	const outlineActive = computed(() => ['draw-area', 'draw-polygon'].includes(deps.activeToolId.value ?? ''));
	const editable = computed(() => outlineActive.value && !deps.writesBlocked.value && saveState.state !== 'saving');
	const areaCorners = createAreaCornerInput(deps.renderState, deps.toolManager, editable);
	watch(deps.activeToolId, areaCorners.reset, { flush: 'sync' });
	const canFinishArea = computed(() => outlineActive.value
		&& areaOutline(deps.renderState.polygonSketch?.vertices ?? []).ok
		&& editable.value && !areaCorners.pending.value
		&& (deps.activeToolId.value !== 'draw-polygon' || deps.roomDraft.name.trim() !== ''));
	const finishArea = (): void => { if (canFinishArea.value) deps.toolManager.finishActiveTool(); };
	return { keepAddingAreas, onAreaCompleted, canFinishArea, finishArea, areaCorners };
}
