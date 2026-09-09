import { orderedWork, reviewRenovation, type ExistingFacts, type PlannedFacts, type Renovation, type RenovationSubject } from '../../../domain/renovation/Renovation';
import { spatialContexts, type SharedSpatialContext } from '../../../domain/renovation/SharedLinks';

/** Room totals include its elements; an element scope includes only that target. */
export function inRenovationScope(item: SharedSpatialContext, roomId: string, targetId = ''): boolean {
	return spatialContexts(item).some(link => targetId && targetId !== roomId ? link.targetId === targetId : link.roomId === roomId);
}

export function renovationSummary(value: Renovation, roomId: string, targetId = '') {
	const subjects = value.subjects.filter(item => inRenovationScope(item, roomId, targetId));
	const work = orderedWork(value).filter(item => inRenovationScope(item, roomId, targetId));
	// Narrowed rather than merely filtered, so a caller reads `item.existing.description`
	// without a non-null assertion the linter refuses outside a template.
	const existing = subjects.filter((item): item is RenovationSubject & { existing: ExistingFacts } => item.existing !== null);
	const planned = subjects.filter((item): item is RenovationSubject & { planned: PlannedFacts } => item.planned !== null);
	const decisions = value.decisions.filter(item => targetId && targetId !== roomId ? subjects.some(subject => subject.id === item.subjectId) : item.roomId === roomId);
	const ids = new Set([...subjects, ...work, ...decisions].map(item => item.id));
	const findings = reviewRenovation(value).filter(item => ids.has(item.recordId));
	const next = findings[0];
	const nextMode = next ? next.kind === 'blocked' || next.kind === 'missing-outcome' ? 'work' : 'planned'
		: !existing.length ? 'existing' : !planned.length ? 'planned' : 'work';
	return { existing, planned, work, findings, next, nextMode,
		complete: work.filter(item => item.progress === 'complete').length,
		changes: planned.filter(item => item.planned?.change !== 'unchanged').length } as const;
}
