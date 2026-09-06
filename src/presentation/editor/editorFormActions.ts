import type { PlanEditorContext } from './PlanEditorContext';
import type { EditorRuntime } from './runtime';
import type { RoomEditRuntime } from './roomEditAction';
import { createAreaDetailsAction } from './metadata/areaDetailsAction';
import { createOutlineEditAction } from './resize/outlineEditAction';
import { createRoomResizeAction } from './resize/roomResizeAction';
import { createRoomNamingAction } from './naming/roomNamingAction';
import { createReferenceAction } from './reference/referenceAction';
/** Root-owned explicit forms share the existing leaf runtime and dialog lifecycle. */
export function createEditorFormActions(context: PlanEditorContext,
	runtime: RoomEditRuntime & Pick<EditorRuntime, 'renderState' | 'dispatcher' | 'writesBlocked' | 'returnToSelect'>) {
	return { areaDetails: createAreaDetailsAction(context, runtime), outlineEdit: createOutlineEditAction(context, runtime),
		...createRoomResizeAction(context, runtime), ...createRoomNamingAction(context, runtime), ...createReferenceAction(context, runtime) };
}
export type EditorFormActions = ReturnType<typeof createEditorFormActions>;
