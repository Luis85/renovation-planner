import { depthRecords, EMPTY_DEPTH } from './PlanningDepth';
import { err, ok, type Result } from '../../core/result/Result';
import type { ValidationError } from '../../core/errors/AppError';
import { EMPTY_STRUCTURE, type Structure } from '../spatial/Structure';
import { renovationError, type Renovation, type RenovationSubject } from './Renovation';
import { spatialContexts, type PrimaryContext, type SharedSpatialContext } from './SharedLinks';

export interface RenovationSpatialContext {
	readonly roomIds: readonly string[];
	readonly structure?: Structure;
	readonly intended?: Structure;
}
function spatialIds(structure: Structure = EMPTY_STRUCTURE, rooms: readonly string[]): Set<string> {
	return new Set([...rooms, ...structure.walls.map(item => item.id), ...structure.openings.map(item => item.id), ...(structure.elements ?? []).map(item => item.id)]);
}

/** A room it names must be present; a record with none must target a wall, opening or element, never a zone (ADR-0030). */
function validPrimaryRoom(item: PrimaryContext, rooms: ReadonlySet<string>): boolean {
	return item.roomId === undefined ? !rooms.has(item.targetId) : rooms.has(item.roomId);
}
function missingContext(item: SharedSpatialContext, rooms: ReadonlySet<string>, present: (id: string) => boolean): boolean {
	return !validPrimaryRoom(item, rooms) || !present(item.targetId) || (item.links ?? []).some(link => !rooms.has(link.roomId) || !present(link.targetId));
}

function materialTargetFits(subject: RenovationSubject, structures: readonly Structure[]): boolean {
	if (subject.existing?.assetId === undefined && subject.planned?.assetId === undefined) return true;
	const ids = structures.flatMap(item => subject.kind === 'wall' ? item.walls.map(wall => wall.id) : item.openings.map(opening => opening.id));
	return ids.includes(subject.targetId);
}

export function validateRenovationTargets(value: Renovation, context: RenovationSpatialContext): Result<void, ValidationError> {
	const linked = value.subjects.filter(item => item.targetId !== item.roomId).map(item => item.targetId);
	if (new Set(linked).size !== linked.length) return err(renovationError('target-owner'));
	const rooms = new Set(context.roomIds);
	const current = spatialIds(context.structure, context.roomIds);
	const intended = spatialIds(context.intended ?? context.structure, context.roomIds);
	for (const subject of value.subjects) {
		if (!validPrimaryRoom(subject, rooms)) return err(renovationError('room-missing'));
		if (!materialTargetFits(subject, [context.structure ?? EMPTY_STRUCTURE, context.intended ?? context.structure ?? EMPTY_STRUCTURE])) return err(renovationError('material-target'));
		if (subject.existing && !current.has(subject.targetId)) return err(renovationError('source-missing'));
		if (subject.planned && subject.planned.change !== 'remove' && !intended.has(subject.targetId)) return err(renovationError('target-missing'));
	}
	const present = (id: string) => current.has(id) || intended.has(id);
	if ([...depthRecords(value.depth ?? EMPTY_DEPTH), ...value.work].some(item => missingContext(item, rooms, present))) return err(renovationError('target-missing'));
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
