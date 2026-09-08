import { EMPTY_RENOVATION, type Renovation } from './Renovation';

function content(value: Renovation): unknown {
	return [value.subjects.map(s => [s.id, s.roomId, s.targetId, s.kind,
		s.existing ? [s.existing.description, s.existing.condition] : null,
		s.planned ? [s.planned.change, s.planned.description] : null]),
	value.work.map(w => [w.id, w.roomId, w.targetId, w.title, w.description, w.order, w.progress, w.responsibility, w.outcomes, w.dependencies]),
	value.decisions.map(d => [d.id, d.roomId, d.subjectId, d.question, d.resolution, d.resolved])];
}
/** Compare owned facts, independent of mapper property insertion order. */
export function sameRenovation(a: Renovation | undefined, b: Renovation | undefined): boolean {
	return JSON.stringify(content(a ?? EMPTY_RENOVATION)) === JSON.stringify(content(b ?? EMPTY_RENOVATION));
}
