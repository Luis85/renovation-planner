import { createEntityId } from '../../../core/identity/generateId';
import { ok } from '../../../core/result/Result';
import { EMPTY_RENOVATION, type RenovationSubject, type WorkPackage } from '../../../domain/renovation/Renovation';
import { EMPTY_DEPTH, type Evidence } from '../../../domain/renovation/PlanningDepth';
import { spatialContexts, type SpatialLink } from '../../../domain/renovation/SharedLinks';
import { EMPTY_STRUCTURE, type Structure } from '../../../domain/spatial/Structure';
import { validateRenovationInput, type RenovationBaseline, type RenovationEditInput } from '../../../application/commands/renovation/RenovationCommand';
import { tr } from '../../i18n/strings';

export interface BatchTarget extends SpatialLink { readonly name: string; readonly kind: RenovationSubject['kind'] }
export type BatchKind = 'remove' | 'modify' | 'work' | 'evidence';
export interface BatchDraft { kind: BatchKind; id: string; title: string; path: string; subpath?: string; type: Evidence['type'] }

function shared<T extends SpatialLink & { readonly links?: readonly SpatialLink[] }>(record: T, targets: readonly BatchTarget[]): T {
	const contexts = spatialContexts(record), keys = new Set(contexts.map(item => JSON.stringify([item.roomId, item.targetId])));
	const added = targets.filter(item => !keys.has(JSON.stringify([item.roomId, item.targetId]))).map(({ roomId, targetId }) => ({ roomId, targetId }));
	return { ...record, links: [...record.links ?? [], ...added] };
}
function replace<T extends { id: string }>(items: readonly T[], value: T): T[] { return [...items.filter(item => item.id !== value.id), value]; }

export function batchRenovationInput(baseline: RenovationBaseline, targets: readonly BatchTarget[], draft: BatchDraft) {
	const value = baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
	let input: RenovationEditInput = { renovation: value, intended: baseline.geometry.document.intended };
	const first = targets[0];
	if (!first) return validateBatch(input, baseline);
	if (draft.kind === 'work') {
		const record: WorkPackage = value.work.find(item => item.id === draft.id) ?? { id: createEntityId('work'), roomId: first.roomId, targetId: first.targetId,
			title: draft.title, description: '', order: value.work.length, progress: 'pending', responsibility: 'unassigned', outcomes: [], dependencies: [] };
		input = { ...input, renovation: { ...value, work: replace(value.work, shared(record, targets)) } };
	} else if (draft.kind === 'evidence') {
		const depth = value.depth ?? EMPTY_DEPTH;
		const record: Evidence = depth.evidence.find(item => item.id === draft.id) ?? { id: createEntityId('evidence'), roomId: first.roomId, targetId: first.targetId,
			workId: '', recordId: '', description: draft.title, type: draft.type, phase: 'before', path: draft.path, subpath: draft.subpath ?? '', pin: null };
		input = { ...input, renovation: { ...value, depth: { ...depth, evidence: replace(depth.evidence, shared(record, targets)) } } };
	} else input = changeTargets(baseline, targets, draft);
	return validateBatch(input, baseline);
}
function validateBatch(input: RenovationEditInput, baseline: RenovationBaseline) {
	const valid = validateRenovationInput(input.renovation, { ...baseline.geometry.document, intended: input.intended });
	return valid.ok ? ok(input) : valid;
}
function affectedTargets(current: Structure, targets: readonly BatchTarget[], removing: boolean): readonly BatchTarget[] {
 if (!removing) return targets;
 const ids = new Set(targets.map(item => item.targetId));
 return [...targets, ...current.openings.flatMap(opening => {
  const host = targets.find(item => item.targetId === opening.hostId);
  if (!host || ids.has(opening.id)) return [];
  return [{ roomId: host.roomId, targetId: opening.id, name: `${tr(`editor.add.${opening.kind}.label`)} · ${host.name}`, kind: opening.kind === 'door' ? 'door' as const : opening.kind === 'window' ? 'window' as const : 'other' as const }];
 })];
}
function changedSubjects(values: readonly RenovationSubject[], targets: readonly BatchTarget[], draft: BatchDraft): readonly RenovationSubject[] {
 let subjects = [...values];
 for (const target of targets) {
  const original = subjects.find(item => item.targetId === target.targetId);
  const subject: RenovationSubject = original ?? { id: createEntityId('detail'), roomId: target.roomId, targetId: target.targetId, kind: target.kind, existing: { description: target.name, condition: 'unknown' }, planned: null };
  subjects = replace(subjects, { ...subject, planned: { change: draft.kind === 'remove' ? 'remove' : 'modify', description: draft.kind === 'remove' ? '' : draft.title } });
 }
 return subjects;
}
function removedTargets(before: Structure, ids: ReadonlySet<string>): Structure {
 return { ...before, elements: before.elements?.filter(item => !ids.has(item.id)), walls: before.walls.filter(item => !ids.has(item.id)), openings: before.openings.filter(item => !ids.has(item.id)), boundaries: before.boundaries.filter(item => !item.wallIds.some(id => ids.has(id))) };
}
function changeTargets(baseline: RenovationBaseline, targets: readonly BatchTarget[], draft: BatchDraft): RenovationEditInput {
 const value = baseline.plan.entity.renovation ?? EMPTY_RENOVATION, current = baseline.geometry.document.structure ?? EMPTY_STRUCTURE;
 const before = baseline.geometry.document.intended ?? current;
 const affected = affectedTargets(current, targets, draft.kind === 'remove'), ids = new Set(affected.map(item => item.targetId));
 const subjects = changedSubjects(value.subjects, affected, draft);
 const intended = draft.kind === 'remove' ? removedTargets(before, ids) : baseline.geometry.document.intended ? restoreTargets(current, before, ids) : undefined;
 return { renovation: { ...value, subjects }, intended };
}
function restoreTargets(current: Structure, before: Structure, ids: ReadonlySet<string>): Structure {
	const walls = [...before.walls, ...current.walls.filter(item => ids.has(item.id) && !before.walls.some(existing => existing.id === item.id))];
	const openings = [...before.openings, ...current.openings.filter(item => ids.has(item.id) && !before.openings.some(existing => existing.id === item.id))];
	const wallIds = new Set(walls.map(item => item.id));
	const boundaries = [...before.boundaries, ...current.boundaries.filter(item => !before.boundaries.some(existing => existing.roomId === item.roomId) && item.wallIds.every(id => wallIds.has(id)))];
	const elements = [...before.elements ?? [], ...current.elements?.filter(item => ids.has(item.id) && !before.elements?.some(existing => existing.id === item.id)) ?? []];
	return { ...before, ...(elements.length ? { elements } : {}), walls, openings, boundaries };
}
