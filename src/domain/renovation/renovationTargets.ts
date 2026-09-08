import { depthRecords, EMPTY_DEPTH } from './PlanningDepth';
import { err, ok, type Result } from '../../core/result/Result';
import type { ValidationError } from '../../core/errors/AppError';
import { EMPTY_STRUCTURE, type Structure } from '../spatial/Structure';
import { renovationError, type Renovation } from './Renovation';
import { spatialContexts } from './SharedLinks';

export interface RenovationSpatialContext {
	readonly roomIds: readonly string[];
	readonly structure?: Structure;
	readonly intended?: Structure;
}
function spatialIds(structure: Structure = EMPTY_STRUCTURE, rooms: readonly string[]): Set<string> {
	return new Set([...rooms, ...structure.walls.map(item => item.id), ...structure.openings.map(item => item.id), ...(structure.elements ?? []).map(item => item.id)]);
}

export function validateRenovationTargets(value: Renovation, context: RenovationSpatialContext): Result<void, ValidationError> {
	const linked = value.subjects.filter(item => item.targetId !== item.roomId).map(item => item.targetId);
	if (new Set(linked).size !== linked.length) return err(renovationError('target-owner'));
	const rooms = new Set(context.roomIds);
	const current = spatialIds(context.structure, context.roomIds);
	const intended = spatialIds(context.intended ?? context.structure, context.roomIds);
	for (const subject of value.subjects) {
		if (!rooms.has(subject.roomId)) return err(renovationError('room-missing'));
		if (subject.existing && !current.has(subject.targetId)) return err(renovationError('source-missing'));
		if (subject.planned && subject.planned.change !== 'remove' && !intended.has(subject.targetId)) return err(renovationError('target-missing'));
	}
	if ([...depthRecords(value.depth ?? EMPTY_DEPTH), ...value.work].flatMap(item => spatialContexts(item)).some(item => !rooms.has(item.roomId) || (!current.has(item.targetId) && !intended.has(item.targetId)))) return err(renovationError('target-missing'));
	return ok(undefined);
}

/** Concrete record labels for a deletion preview; no count-only permission. */
export function renovationReferents(value: Renovation, targetId: string): readonly string[] {
	return [
		...[...value.depth?.costs ?? [], ...value.depth?.evidence ?? [], ...value.depth?.procurement ?? []].filter(item => spatialContexts(item).some(link => link.roomId === targetId || link.targetId === targetId)).map(item => 'title' in item ? item.title : 'description' in item ? item.description : item.requirementId),
		...value.subjects.filter(item => item.roomId === targetId || item.targetId === targetId).map(item => item.existing?.description || item.planned?.description || item.id),
		...value.work.filter(item => spatialContexts(item).some(link => link.roomId === targetId || link.targetId === targetId)).map(item => item.title),
		...value.decisions.filter(item => item.roomId === targetId).map(item => item.question),
	];
}
