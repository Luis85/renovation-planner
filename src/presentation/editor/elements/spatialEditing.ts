import type { PlanEditorContext } from '../PlanEditorContext';
import { createElementTask } from './elementTask';
import { createElementActions } from './elementActions';
import { createRotationActions, type RotationRuntime } from './rotationActions';
import type { ElementMoveDeps } from './ElementMove';
import type { RotationGestureDeps } from './ElementRotation';
import { createCurveTask, type CurveTaskRuntime } from '../curves/curveTask';
import { createGroupActions } from '../groups/groupActions';
import type { SelectionInteractions } from '../selection/selectionInteractions';

/** Compose the existing per-leaf element/rotation actions and their shared pointer bindings. */
export function createSpatialEditing(context: PlanEditorContext, runtime: Parameters<typeof createElementTask>[1] & Parameters<typeof createElementActions>[1] & Omit<RotationRuntime, 'elementActions'> & CurveTaskRuntime) {
	const elementTask = createElementTask(context, runtime);
	const elementActions = createElementActions(context, runtime);
	const groupActions = createGroupActions(context, { ...runtime, spatialBusy: () => elementActions.active.value || runtime.wall?.active.value === true });
	const rotationActions = createRotationActions(context, { ...runtime, elementActions, groups: groupActions, groupRotationTarget: groupActions.groupRotationTarget });
	const curveTask = createCurveTask(context, runtime);
	const toolBindings: ElementMoveDeps & RotationGestureDeps & SelectionInteractions = {
		expandSelection: groupActions.expandSelection, selectionMove: groupActions.selectionMove,
		canRotateShape: rotationActions.canRotateId,
		rotationTarget: () => rotationActions.target.value,
		rotationDisplayTarget: () => rotationActions.displayTarget.value,
		rotationControls: () => rotationActions.displayControls.value,
		requestRotation: id => { void rotationActions.rotate(id); },
		previewRotation: rotationActions.previewShape,
		commitRotation: (id, points, original) => { void rotationActions.move(id, points, original); },
		previewElement: elementActions.previewElement,
		moveElement: (id, points, original) => { void elementActions.move(id, points, original); },
	};
	return { elementTask, elementActions, groupActions, rotationActions, curveTask, toolBindings };
}
export type SpatialEditing = ReturnType<typeof createSpatialEditing>;
