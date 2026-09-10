import { markRaw } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import { validSpatialElement, type NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { areaOutline } from '../add/areaOutline';
import OutlinePointsForm from '../resize/OutlinePointsForm.vue';
import StairEditForm from './StairEditForm.vue';
import type { StairEdit } from './stairInput';

/** Form differences stop here; one guarded command callback remains the write authority. */
export function elementEditPresentation(element: NamedSpatialElement,
	dispatch: (value: Pick<NamedSpatialElement, 'name' | 'points' | 'stair'>) => Promise<DispatchResult>,
	preview: (value: NamedSpatialElement | null) => void) {
	if (element.kind === 'stair' && element.stair) return { component: markRaw(StairEditForm), props: {
		options: element.stair,
		dispatch,
		preview: (value: StairEdit | null) => preview(value ? { ...element, ...value } : null),
	} };
	return { component: markRaw(OutlinePointsForm), props: {
		hint: 'editor.element.edit-hint',
		accepts: (points: readonly Point[]) => validSpatialElement({ ...element, points }) && (element.kind !== 'object' || areaOutline(points).ok),
		preview: (polygon: { points: readonly Point[] } | null) => preview(polygon ? { ...element, points: polygon.points } : null),
		dispatch: (polygon: { points: readonly Point[] }, name: string) => dispatch({ name, points: polygon.points }),
	} };
}
