import { computed, ref, watch, type Ref } from 'vue';
import type { ToolId } from '../tools/editor-tool';
import type { ToolManager } from '../tools/tool-manager';
import type { RenderState } from '../tools/render-state';
import { useSaveStateStore } from '../save-state/save-state-store';
import { areaOutline } from './areaOutline';

/** Per-leaf task preferences and the button facade over the geometry tool's one completion. */
export function createAreaTask(deps: {
	toolManager: ToolManager;
	activeToolId: Ref<ToolId | null>;
	renderState: RenderState;
	writesBlocked: Readonly<Ref<boolean>>;
	returnToSelect: () => void;
}) {
	const keepAddingAreas = ref(false);
	// Repetition belongs to this activation, never to a later task or another leaf.
	watch(deps.activeToolId, () => { keepAddingAreas.value = false; }, { flush: 'sync' });
	const onAreaCompleted = (): void => { if (!keepAddingAreas.value) deps.returnToSelect(); };
	const saveState = useSaveStateStore();
	const canFinishArea = computed(() => deps.activeToolId.value === 'draw-area'
		&& areaOutline(deps.renderState.polygonSketch?.vertices ?? []).ok
		&& !deps.writesBlocked.value && saveState.state !== 'saving');
	const finishArea = (): void => { if (canFinishArea.value) deps.toolManager.finishActiveTool(); };
	return { keepAddingAreas, onAreaCompleted, canFinishArea, finishArea };
}
