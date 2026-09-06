import type { ValidationError } from '../../core/errors/AppError';
import { err, ok, type Result } from '../../core/result/Result';

export const CONDITIONS = ['unknown', 'good', 'worn', 'damaged', 'investigate'] as const;
export const DETAIL_KINDS = ['floor', 'wall', 'ceiling', 'heating', 'door', 'window', 'fixture', 'other'] as const;
export const CHANGES = ['unchanged', 'remove', 'modify', 'add'] as const;
export const WORK_PROGRESS = ['pending', 'in-progress', 'complete'] as const;
export interface ExistingFacts {
	readonly description: string;
	readonly condition: typeof CONDITIONS[number];
}
export interface PlannedFacts {
	readonly change: typeof CHANGES[number];
	readonly description: string;
}
/** One identifiable subject, two independent semantic states (ADR-0021). */
export interface RenovationSubject {
	readonly id: string;
	readonly roomId: string;
	readonly targetId: string;
	readonly kind: typeof DETAIL_KINDS[number];
	readonly existing: ExistingFacts | null;
	readonly planned: PlannedFacts | null;
}
export interface WorkPackage {
	readonly id: string;
	readonly roomId: string;
	readonly targetId: string;
	readonly title: string;
	readonly description: string;
	readonly order: number;
	readonly progress: typeof WORK_PROGRESS[number];
	readonly responsibility: 'unassigned' | 'diy';
	readonly outcomes: readonly string[];
	readonly dependencies: readonly string[];
}
export interface RenovationDecision {
	readonly id: string;
	readonly roomId: string;
	readonly subjectId: string;
	readonly question: string;
	readonly resolution: string;
	readonly resolved: boolean;
}
/** Owned by the containing Plan's Project. No filenames or presentation state in links. */
export interface Renovation {
	readonly subjects: readonly RenovationSubject[];
	readonly work: readonly WorkPackage[];
	readonly decisions: readonly RenovationDecision[];
}
export const EMPTY_RENOVATION: Renovation = { subjects: [], work: [], decisions: [] };
export function renovationError(code: string): ValidationError {
	return { category: 'Validation', code: `renovation.${code}`, message: `Invalid renovation record: ${code}.` };
}

function validSubject(subject: RenovationSubject): boolean {
	const { existing, planned } = subject;
	if (!existing && !planned) return false;
	if (existing && (!existing.description.trim() || !CONDITIONS.includes(existing.condition))) return false;
	if (!DETAIL_KINDS.includes(subject.kind)) return false;
	if (!planned) return true;
	if (!CHANGES.includes(planned.change)) return false;
	if ((planned.change === 'add') !== (existing === null)) return false;
	if (planned.change === 'remove') return planned.description === '';
	if (planned.change === 'unchanged') return planned.description === existing?.description;
	return planned.description.trim().length > 0;
}

function hasCycle(work: readonly WorkPackage[]): boolean {
	const byId = new Map(work.map(item => [item.id, item]));
	const visited = new Set<string>(), active = new Set<string>();
	function visit(id: string): boolean {
		if (active.has(id)) return true;
		if (visited.has(id)) return false;
		active.add(id);
		if (byId.get(id)?.dependencies.some(visit)) return true;
		active.delete(id); visited.add(id);
		return false;
	}
	return work.some(item => visit(item.id));
}

function validWork(item: WorkPackage): boolean {
	return !!item.title.trim() && !!item.targetId.trim() && Number.isSafeInteger(item.order) && item.order >= 0
		&& WORK_PROGRESS.includes(item.progress) && ['unassigned', 'diy'].includes(item.responsibility);
}
export function validateRenovation(value: Renovation): Result<void, ValidationError> {
	const all = [...value.subjects, ...value.work, ...value.decisions];
	if (all.some(item => !item.id.trim() || !item.roomId.trim()) || new Set(all.map(item => item.id)).size !== all.length) return err(renovationError('identity'));
	if (value.subjects.some(item => !item.targetId.trim() || !validSubject(item))) return err(renovationError('state'));
	const subjects = new Map(value.subjects.map(item => [item.id, item]));
	const workIds = new Set(value.work.map(item => item.id));
	for (const item of value.work) {
		if (!validWork(item)) return err(renovationError('work'));
		if (new Set(item.dependencies).size !== item.dependencies.length || item.dependencies.some(id => !workIds.has(id))) return err(renovationError('dependency'));
		if (new Set(item.outcomes).size !== item.outcomes.length || item.outcomes.some(id => !subjects.get(id)?.planned || subjects.get(id)?.roomId !== item.roomId)) return err(renovationError('outcome'));
	}
	if (hasCycle(value.work)) return err(renovationError('cycle'));
	if (value.decisions.some(item => !item.question.trim() || (item.resolved && !item.resolution.trim()) || subjects.get(item.subjectId)?.roomId !== item.roomId)) return err(renovationError('decision'));
	return ok(undefined);
}

export function orderedWork(value: Renovation): readonly WorkPackage[] {
	return value.work.toSorted((a, b) => a.order - b.order || a.id.localeCompare(b.id, 'en'));
}
export function blockingWork(value: Renovation, item: WorkPackage): readonly WorkPackage[] {
	return orderedWork(value).filter(other => item.dependencies.includes(other.id) && other.progress !== 'complete');
}

export interface ReadinessFinding {
	readonly kind: 'decision' | 'missing-work' | 'missing-outcome' | 'blocked';
	readonly roomId: string;
	readonly recordId: string;
	readonly causes: readonly string[];
}
/** Fixed rule order, stable record-ID order; never asserts readiness in unavailable domains. */
export function reviewRenovation(value: Renovation): readonly ReadinessFinding[] {
	const findings: ReadinessFinding[] = [];
	for (const item of value.decisions) if (!item.resolved) findings.push({ kind: 'decision', roomId: item.roomId, recordId: item.id, causes: [item.question] });
	for (const item of value.subjects) if (item.planned && item.planned.change !== 'unchanged' && !value.work.some(work => work.outcomes.includes(item.id))) findings.push({ kind: 'missing-work', roomId: item.roomId, recordId: item.id, causes: [item.planned.description || item.existing?.description || item.id] });
	for (const item of value.work) {
		if (item.outcomes.length === 0) findings.push({ kind: 'missing-outcome', roomId: item.roomId, recordId: item.id, causes: [item.title] });
		const blocked = blockingWork(value, item);
		if (item.progress !== 'complete' && blocked.length) findings.push({ kind: 'blocked', roomId: item.roomId, recordId: item.id, causes: blocked.map(other => other.title) });
	}
	return findings.toSorted((a, b) => a.kind.localeCompare(b.kind, 'en') || a.recordId.localeCompare(b.recordId, 'en'));
}
