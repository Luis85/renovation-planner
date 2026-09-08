import type { PlanEditorContext } from '../PlanEditorContext';
import { createElementTask } from './elementTask';
import { createElementActions } from './elementActions';
import { createRotationActions } from './rotationActions';
import type { ElementMoveDeps } from './ElementMove';
import type { RotationGestureDeps } from './ElementRotation';

type Runtime = Parameters<typeof createElementTask>[1] & Parameters<typeof createElementActions>[1] & Omit<Parameters<typeof createRotationActions>[1], 'elementActions'>;
/** Compose the existing per-leaf element/rotation actions and their shared pointer bindings. */
export function createSpatialEditing(context: PlanEditorContext, runtime: Runtime) {
	const elementTask = createElementTask(context, runtime);
	const elementActions = createElementActions(context, runtime);
	const rotationActions = createRotationActions(context, { ...runtime, elementActions });
	const toolBindings: ElementMoveDeps & RotationGestureDeps = {
		canRotateShape: () => !rotationActions.blocked.value && !rotationActions.active.value,
		rotationTarget: () => rotationActions.target.value,
		rotationControl: () => rotationActions.handleGeometry.value,
		requestRotation: id => { void rotationActions.rotate(id); },
		previewRotation: rotationActions.previewShape,
		commitRotation: (id, points, original) => { void rotationActions.move(id, points, original); },
		previewElement: elementActions.previewElement,
		moveElement: (id, points, original) => { void elementActions.move(id, points, original); },
	};
	return { elementTask, elementActions, rotationActions, toolBindings };
}
export type SpatialEditing = ReturnType<typeof createSpatialEditing>;
