import { describe, expect, it } from 'vitest';
import { EMPTY_RENOVATION, blockingWork, orderedWork, reviewRenovation, validateRenovation, type Renovation, type RenovationSubject, type WorkPackage } from '../../src/domain/renovation/Renovation';
import { renovationReferents, validateRenovationTargets } from '../../src/domain/renovation/renovationTargets';

const subject: RenovationSubject = { id: 'detail-a', roomId: 'room-a', targetId: 'room-a', kind: 'floor', existing: { description: 'Worn timber', condition: 'worn' }, planned: { change: 'modify', description: 'Refinished timber' } };
const work: WorkPackage = { id: 'work-a', roomId: 'room-a', targetId: 'room-a', title: 'Sand timber', description: '', order: 0, responsibility: 'diy', progress: 'pending', outcomes: [subject.id], dependencies: [] };
const base: Renovation = { subjects: [subject], work: [work], decisions: [{ id: 'decision-a', roomId: 'room-a', subjectId: subject.id, question: 'Which finish?', resolution: '', resolved: false }] };
describe('independent renovation states and readiness', () => {
	it('preserves current facts, resolves decisions and derives scoped findings deterministically', () => {
		expect(validateRenovation(base).ok).toBe(true);
		expect(reviewRenovation(base)).toEqual([{ kind: 'decision', roomId: 'room-a', recordId: 'decision-a', causes: ['Which finish?'] }]);
		const resolved = { ...base, decisions: [{ ...base.decisions[0], resolved: true, resolution: 'Hard wax oil' }] };
		expect(validateRenovation(resolved).ok).toBe(true);
		expect(reviewRenovation(resolved)).toEqual([]);
		expect(subject.existing?.description).toBe('Worn timber');
	});
	it.each(['unchanged', 'remove', 'modify', 'add'] as const)('enforces %s predecessor and fact invariants', change => {
		const item = { ...subject, existing: change === 'add' ? null : subject.existing, planned: { change, description: change === 'remove' ? '' : change === 'unchanged' ? 'Worn timber' : 'New finish' } };
		expect(validateRenovation({ ...EMPTY_RENOVATION, subjects: [item] }).ok).toBe(true);
		expect(validateRenovation({ ...EMPTY_RENOVATION, subjects: [{ ...item, existing: item.existing ? null : subject.existing }] }).ok).toBe(false);
	});
	it.each([
		{ existing: null, planned: null }, { existing: { description: ' ', condition: 'good' }, planned: null },
		{ planned: { change: 'remove', description: 'replacement' } }, { planned: { change: 'unchanged', description: 'Different facts' } },
		{ planned: { change: 'modify', description: ' ' } }, { kind: 'unsupported' }, { existing: { description: 'Timber', condition: 'unsafe-value' } },
		{ planned: { change: 'unsupported', description: 'New' } }, { targetId: '' }, { roomId: '' }, { id: '' },
	])('refuses invalid subject %j', patch => {
		expect(validateRenovation({ ...EMPTY_RENOVATION, subjects: [{ ...subject, ...patch } as RenovationSubject] }).ok).toBe(false);
	});
	it('allows a partial survey without a proposal and refuses identity collisions', () => {
		expect(validateRenovation({ ...EMPTY_RENOVATION, subjects: [{ ...subject, planned: null }] }).ok).toBe(true);
		expect(validateRenovation({ ...base, work: [{ ...work, id: subject.id }] }).ok).toBe(false);
	});
	it.each([{ title: '' }, { targetId: '' }, { order: -1 }, { order: 0.5 }, { progress: 'blocked' }, { responsibility: 'invented-trade' }, { dependencies: ['missing'] }, { dependencies: ['work-a', 'work-a'] }, { outcomes: ['missing'] }, { outcomes: ['detail-a', 'detail-a'] }])('refuses invalid work %j', patch => {
		expect(validateRenovation({ ...base, work: [{ ...work, ...patch } as WorkPackage] }).ok).toBe(false);
	});
	it('refuses missing, foreign-room and cancelled outcomes', () => {
		for (const patch of [{ roomId: 'other' }, { planned: null }]) expect(validateRenovation({ ...base, subjects: [{ ...subject, ...patch }] }).ok).toBe(false);
	});
	it('allows useful incomplete work, derives blockers and refuses direct and indirect cycles', () => {
		const later = { ...work, id: 'work-b', order: 1, outcomes: [], dependencies: [work.id] };
		const value = { ...base, work: [later, work] };
		expect(validateRenovation(value).ok).toBe(true);
		expect(orderedWork(value).map(item => item.id)).toEqual(['work-a', 'work-b']);
		expect(blockingWork(value, later)).toEqual([work]);
		expect(reviewRenovation(value).map(item => item.kind)).toEqual(['blocked', 'decision', 'missing-outcome']);
		expect(validateRenovation({ ...value, work: [later, { ...work, dependencies: [later.id] }] })).toMatchObject({ ok: false, error: { code: 'renovation.cycle' } });
		expect(validateRenovation({ ...base, work: [{ ...work, dependencies: [work.id] }] }).ok).toBe(false);
		const completed = { ...value, work: [later, { ...work, progress: 'complete' as const }] };
		expect(blockingWork(completed, later)).toEqual([]);
		expect(reviewRenovation({ ...value, work: [{ ...later, progress: 'complete' as const }, work] }).some(item => item.kind === 'blocked')).toBe(false);
	});
	it('orders ties by ID and handles shared dependency branches without false cycles', () => {
		const a = { ...work, id: 'a', dependencies: ['c'] }, b = { ...work, id: 'b', dependencies: ['c'] }, c = { ...work, id: 'c' };
		const value = { ...base, work: [b, a, c] };
		expect(validateRenovation(value).ok).toBe(true);
		expect(orderedWork(value).map(item => item.id)).toEqual(['a', 'b', 'c']);
	});
	it.each([{ question: '' }, { resolved: true }, { subjectId: 'missing' }, { roomId: 'foreign' }])('refuses invalid decision %j', patch => {
		expect(validateRenovation({ ...base, decisions: [{ ...base.decisions[0], ...patch }] }).ok).toBe(false);
	});
	it('finds unproduced outcomes while ignoring unchanged or unproposed facts', () => {
		expect(reviewRenovation({ ...base, work: [] }).map(item => item.kind)).toEqual(['decision', 'missing-work']);
		for (const planned of [null, { change: 'unchanged' as const, description: 'Worn timber' }]) expect(reviewRenovation({ ...EMPTY_RENOVATION, subjects: [{ ...subject, planned }] })).toEqual([]);
		expect(reviewRenovation({ ...EMPTY_RENOVATION, subjects: [{ ...subject, planned: { change: 'remove', description: '' } }] })[0].causes).toEqual(['Worn timber']);
		// A subject described nowhere is still named in the finding, by the one stable thing it has.
		expect(reviewRenovation({ ...EMPTY_RENOVATION, subjects: [{ ...subject, existing: null, planned: { change: 'add', description: '' } }] })[0].causes).toEqual([subject.id]);
	});
	it('validates stable targets separately from labels and lists referential impact', () => {
		expect(validateRenovationTargets(base, { roomIds: ['room-a'] }).ok).toBe(true);
		expect(renovationReferents(base, 'room-a')).toEqual(['Worn timber', 'Sand timber', 'Which finish?']);
		expect(renovationReferents(base, 'unknown')).toEqual([]);
		expect(validateRenovationTargets(base, { roomIds: [] }).ok).toBe(false);
		expect(validateRenovationTargets({ ...base, subjects: [{ ...subject, targetId: 'wall-missing' }] }, { roomIds: ['room-a'] }).ok).toBe(false);
		expect(validateRenovationTargets({ ...base, subjects: [{ ...subject, existing: null, targetId: 'wall-missing' }] }, { roomIds: ['room-a'] }).ok).toBe(false);
		expect(validateRenovationTargets({ ...base, work: [{ ...work, targetId: 'missing' }] }, { roomIds: ['room-a'] }).ok).toBe(false);
	});
});

it('refuses competing spatial owners and orders multiple decisions by their stable IDs', () => {
 const first = { ...subject, targetId: 'wall-a' };
 expect(validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [first, { ...first, id: 'detail-b' }] }, { roomIds: ['room-a'] })).toMatchObject({ ok: false, error: { code: 'renovation.target-owner' } });
 const decisions = [{ ...base.decisions[0], id: 'z' }, { ...base.decisions[0], id: 'a' }];
 expect(reviewRenovation({ ...base, decisions }).map(item => item.recordId)).toEqual(['a', 'z']);
 const addition = { ...subject, existing: null, planned: { change: 'add' as const, description: 'New lining' } };
 expect(renovationReferents({ ...EMPTY_RENOVATION, subjects: [addition] }, 'room-a')).toEqual(['New lining']);
});
