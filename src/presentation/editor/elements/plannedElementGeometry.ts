import type { Structure } from '../../../domain/spatial/Structure';
import type { SpatialElement } from '../../../domain/spatial/SpatialElement';
import { validSpatialElement } from '../../../domain/spatial/SpatialElement';
import { err, ok } from '../../../core/result/Result';
import { spatialError } from '../../../domain/spatial/structureGeometry';
import { outlineProposal, type CoordinateEdits } from '../resize/outlineProposal';
import { areaOutline } from '../add/areaOutline';

export function plannedElementGeometry(current: Structure, before: Structure, input: { id: string; element?: SpatialElement; edits?: CoordinateEdits; change: string }) {
	const remaining = before.elements?.filter(item => item.id !== input.id) ?? [];
	if (input.change === 'remove') return ok({ ...before, elements: remaining });
	const original = current.elements?.find(item => item.id === input.id);
	const element = input.change === 'unchanged' ? original : input.element;
	if (!element) return err(spatialError('element-invalid'));
	const proposal = outlineProposal(element.points, input.change === 'unchanged' ? [] : input.edits ?? [], points => validSpatialElement({ ...element, points }) && (element.kind !== 'object' || areaOutline(points).ok));
	if (!proposal.polygon) return err(spatialError('element-invalid'));
	return ok({ ...before, elements: [...remaining, { ...element, points: proposal.polygon.points }] });
}
