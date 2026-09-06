import { createEntityId } from '../../../core/identity/generateId';
import { EMPTY_RENOVATION, type Renovation, type RenovationSubject, type WorkPackage, type RenovationDecision } from '../../../domain/renovation/Renovation';
import type { RenovationInput, RenovationBaseline } from '../../../application/commands/renovation/RenovationCommand';

export type RenovationEditKind = 'existing' | 'planned' | 'work' | 'decision';
export interface RenovationDraft {
	kind: RenovationEditKind;
	subject: RenovationSubject;
	work: WorkPackage;
	decision: RenovationDecision;
}
export type EditableRenovationDraft<T = RenovationDraft> = T extends object ? { -readonly [K in keyof T]: EditableRenovationDraft<T[K]> } : T;
function subjectDraft(kind: RenovationEditKind, roomId: string, subject: RenovationSubject | undefined): RenovationSubject {
	return subject ? { ...subject, existing: subject.existing && { ...subject.existing }, planned: kind === 'planned' ? subject.planned ?? { change: 'modify', description: subject.existing?.description ?? '' } : subject.planned } : {
			id: createEntityId('detail'), roomId, targetId: roomId, kind: 'floor',
			existing: kind === 'existing' ? { description: '', condition: 'unknown' } : null,
			planned: kind === 'planned' ? { change: 'add', description: '' } : null,
		};
}
export function renovationDraft(kind: RenovationEditKind, roomId: string, recordId: string, value: Renovation = EMPTY_RENOVATION): RenovationDraft {
	const subject = value.subjects.find(item => item.id === recordId);
	return {
		kind,
		subject: subjectDraft(kind, roomId, subject),
		work: value.work.find(item => item.id === recordId) ?? {
			id: createEntityId('work'), roomId, targetId: subject?.targetId ?? roomId, title: '', description: '',
			order: value.work.length, progress: 'pending', responsibility: 'unassigned', outcomes: subject?.planned ? [subject.id] : [], dependencies: [],
		},
		decision: value.decisions.find(item => item.id === recordId) ?? {
			id: createEntityId('decision'), roomId, subjectId: subject?.id ?? '', question: '', resolution: '', resolved: false,
		},
	};
}
function upsert<T extends { id: string }>(items: readonly T[], item: T): readonly T[] {
	return items.some(other => other.id === item.id) ? items.map(other => other.id === item.id ? item : other) : [...items, item];
}
export function applyRenovationDraft(baseline: RenovationBaseline, draft: RenovationDraft): RenovationInput {
	const value = baseline.plan.entity.renovation ?? EMPTY_RENOVATION;
	const renovation = draft.kind === 'work' ? { ...value, work: upsert(value.work, draft.work) }
		: draft.kind === 'decision' ? { ...value, decisions: upsert(value.decisions, draft.decision) }
			: { ...value, subjects: upsert(value.subjects, draft.subject) };
	return { renovation, intended: baseline.geometry.document.intended };
}
