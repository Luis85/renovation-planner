import type { PlanEditorContext } from '../PlanEditorContext';
import { createElementTask } from './elementTask';
import { createElementActions } from './elementActions';
import { createRotationActions, type RotationRuntime } from './rotationActions';
import type { ElementMoveDeps } from './ElementMove';
import type { RotationGestureDeps } from './ElementRotation';
import { createCurveTask, type CurveTaskRuntime } from '../curves/curveTask';
import { createGroupActions } from '../groups/groupActions';
import type { SelectionInteractions } from '../selection/selectionInteractions';
import { watchAssetShapes } from './assetShapeLoader';
import { createAssetPlacementTask } from './assetPlacementTask';
import { createItemPromotion } from './itemPromotion';
import { createLabelActions } from '../labels/labelActions';
import type { LabelMoveDeps } from '../labels/LabelMove';

/** Compose the existing per-leaf element/rotation actions and their shared pointer bindings. */
export function createSpatialEditing(context: PlanEditorContext, runtime: Parameters<typeof createElementTask>[1] & Parameters<typeof createElementActions>[1] & Omit<RotationRuntime, 'elementActions'> & CurveTaskRuntime & Parameters<typeof createAssetPlacementTask>[1]) {
	watchAssetShapes(context);
	const elementActions = createElementActions(context, runtime);
	const assets = createAssetPlacementTask(context, runtime);
	const promotion = createItemPromotion(context, assets, { writesBlocked: runtime.writesBlocked, elementActionsActive: elementActions.active });
	const elementTask = Object.assign(createElementTask(context, runtime), { assets, promotion });
	const groupActions = createGroupActions(context, { ...runtime, spatialBusy: () => elementActions.active.value || runtime.wall?.active.value === true });
	const rotationActions = createRotationActions(context, { ...runtime, elementActions, groups: groupActions, groupRotationTarget: groupActions.groupRotationTarget });
	const labelActions = createLabelActions(context, runtime);
	const curveTask = createCurveTask(context, runtime);
	const toolBindings: ElementMoveDeps & RotationGestureDeps & SelectionInteractions & LabelMoveDeps = {
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
		elementWritesBlocked: () => elementActions.blocked.value || elementActions.active.value,
		labelHits: () => labelActions.hits.value,
		moveLabel: (id, offset) => { void labelActions.move(id, offset); },
	};
	return { elementTask, elementActions, groupActions, rotationActions, labelActions, curveTask, toolBindings };
}
export type SpatialEditing = ReturnType<typeof createSpatialEditing>;
