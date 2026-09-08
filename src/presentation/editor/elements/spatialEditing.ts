import type { PlanEditorContext } from '../PlanEditorContext';
import { createElementTask } from './elementTask';
import { createElementActions } from './elementActions';
import { createRotationActions, type RotationRuntime } from './rotationActions';
import type { ElementMoveDeps } from './ElementMove';
import type { RotationGestureDeps } from './ElementRotation';
import { createCurveTask } from '../curves/curveTask';

/** Compose the existing per-leaf element/rotation actions and their shared pointer bindings. */
export function createSpatialEditing(context: PlanEditorContext, runtime: Parameters<typeof createElementTask>[1] & Parameters<typeof createElementActions>[1] & Omit<RotationRuntime, 'elementActions'> & Parameters<typeof createCurveTask>[1]) {
	const elementTask = createElementTask(context, runtime);
	const elementActions = createElementActions(context, runtime);
	const rotationActions = createRotationActions(context, { ...runtime, elementActions });
	const curveTask = createCurveTask(context, runtime);
	const toolBindings: ElementMoveDeps & RotationGestureDeps = {
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
	return { elementTask, elementActions, rotationActions, curveTask, toolBindings };
}
export type SpatialEditing = ReturnType<typeof createSpatialEditing>;
