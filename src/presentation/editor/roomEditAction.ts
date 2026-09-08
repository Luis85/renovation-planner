import type { Loaded } from '../../application/ports/versioning';
import type { Zone } from '../../domain/zone/Zone';
import type { PlanEditorContext } from './PlanEditorContext';
import type { FormDescriptor } from '../dialogs/dialog-store';
import { useDialogStore } from '../dialogs/dialog-store';
import { createRoomEditLifecycle, type RoomEditControls, type RoomEditOptions, type RoomEditRuntime } from './roomEditLifecycle';
export type { RoomEditRuntime } from './roomEditLifecycle';

export interface RoomEditDefinition extends RoomEditOptions {
	form(baseline: Loaded<Zone>, controls: RoomEditControls): FormDescriptor | null;
}

/** Modal presentation retains the same shared versioned Room edit lifetime. */
export function createRoomEditAction(context: PlanEditorContext, runtime: RoomEditRuntime, definition: RoomEditDefinition) {
	const dialogs = useDialogStore();
	return createRoomEditLifecycle(context, runtime, definition, async (baseline, controls) => {
		const descriptor = definition.form(baseline, controls);
		if (descriptor !== null) await dialogs.openDialog(descriptor);
	});
}
