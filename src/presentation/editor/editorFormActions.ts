import type { PlanEditorContext } from './PlanEditorContext';
import type { EditorRuntime } from './runtime';
import type { RoomEditRuntime } from './roomEditAction';
import { createAreaDetailsAction } from './metadata/areaDetailsAction';
import { createRoomResizeAction } from './resize/roomResizeAction';
import { createRoomNamingAction } from './naming/roomNamingAction';
import { createReferenceAction } from './reference/referenceAction';
import { createRoomDimensionAction } from './resize/roomDimensionAction';
import { onBeforeUnmount } from 'vue';
/** Root-owned explicit forms share the existing leaf runtime and dialog lifecycle. */
export function createEditorFormActions(context: PlanEditorContext,
	runtime: RoomEditRuntime & Pick<EditorRuntime, 'renderState' | 'dispatcher' | 'toolManager' | 'setTool' | 'returnToSelect'>) {
	onBeforeUnmount(() => runtime.toolManager.dispose());
	return { roomDimension: createRoomDimensionAction(context, runtime), areaDetails: createAreaDetailsAction(context, runtime),
		...createRoomResizeAction(context, runtime), ...createRoomNamingAction(context, runtime), ...createReferenceAction(context, runtime) };
}
export type EditorFormActions = ReturnType<typeof createEditorFormActions>;
