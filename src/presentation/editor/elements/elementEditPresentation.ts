import { markRaw } from 'vue';
import type { Point } from '../../../core/geometry/Point';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { NamedSpatialElement } from '../../../domain/spatial/SpatialElement';
import { acceptsElementPoints } from './elementDraft';
import OutlinePointsForm from '../resize/OutlinePointsForm.vue';
import StairEditForm from './StairEditForm.vue';
import StructuralEditForm from './StructuralEditForm.vue';
import DimensionEditForm from './DimensionEditForm.vue';
import type { StairEdit } from './stairInput';
import type { StructuralEdit } from './structuralInput';
import type { DimensionEdit } from './dimensionInput';

/** Form differences stop here; one guarded command callback remains the write authority. */
export function elementEditPresentation(element: NamedSpatialElement,
	dispatch: (value: Pick<NamedSpatialElement, 'name' | 'points' | 'stair' | 'width' | 'offset'>) => Promise<DispatchResult>,
	preview: (value: NamedSpatialElement | null) => void) {
	if (element.kind === 'stair' && element.stair) return { component: markRaw(StairEditForm), props: {
		options: element.stair,
		dispatch,
		preview: (value: StairEdit | null) => preview(value ? { ...element, ...value } : null),
	} };
	if (element.kind === 'post' || element.kind === 'beam') return { component: markRaw(StructuralEditForm), props: {
		kind: element.kind,
		...(element.width === undefined ? {} : { width: element.width }),
		dispatch: (value: StructuralEdit) => dispatch(value),
		preview: (value: StructuralEdit | null) => preview(value ? { ...element, ...value } : null),
	} };
	if (element.kind === 'dimension' && element.offset !== undefined) return { component: markRaw(DimensionEditForm), props: {
		offset: element.offset,
		dispatch: (value: DimensionEdit) => dispatch(value),
		preview: (value: DimensionEdit | null) => preview(value ? { ...element, ...value } : null),
	} };
	return { component: markRaw(OutlinePointsForm), props: {
		hint: 'editor.element.edit-hint',
		...(element.kind === 'text' ? { nameLabel: 'editor.drafting.text' as const } : {}),
		accepts: (points: readonly Point[]) => acceptsElementPoints(element, points),
		preview: (polygon: { points: readonly Point[] } | null) => preview(polygon ? { ...element, points: polygon.points } : null),
		dispatch: (polygon: { points: readonly Point[] }, name: string) => dispatch({ name, points: polygon.points }),
	} };
}
