import { describe, expect, it } from 'vitest';
import { EMPTY_RENOVATION, reviewRenovation, validateRenovation, type Renovation, type RenovationSubject, type WorkPackage } from '../../src/domain/renovation/Renovation';
import { renovationReferents, validateRenovationTargets } from '../../src/domain/renovation/renovationTargets';
import { contextOf, hasRoomContext, spatialContexts } from '../../src/domain/renovation/SharedLinks';
import { EMPTY_DEPTH, type CostRecord, type Evidence } from '../../src/domain/renovation/PlanningDepth';
import { of } from '../../src/core/money/Money';
import { WALL_LOOP } from '../helpers/structure';

const room = 'room-a';
const context = { roomIds: [room], structure: WALL_LOOP };
const subject: RenovationSubject = { id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Rendered brick', condition: 'good' }, planned: { change: 'modify', description: 'Repointed brick' } };
const work: WorkPackage = { id: 'work-wall', targetId: 'wall-a', title: 'Repoint', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: [subject.id], dependencies: [] };
const cost: CostRecord = { id: 'cost-wall', targetId: 'wall-a', workId: work.id, title: 'Mortar', category: 'other', requirementId: '', planned: of('40', 'EUR'), facts: [], cancelled: false };
const photo: Evidence = { id: 'photo-wall', targetId: 'wall-a', workId: work.id, description: 'Before', type: 'photo', phase: 'before', path: 'wall.jpg', subpath: '', recordId: subject.id, pin: null };
const value: Renovation = { subjects: [subject], work: [work], decisions: [{ id: 'decision-wall', subjectId: subject.id, question: 'Lime or cement?', resolution: '', resolved: false }], depth: { ...EMPTY_DEPTH, costs: [cost], evidence: [photo] } };
const withDepth = (patch: Partial<Evidence> | Partial<CostRecord>, kind: 'evidence' | 'costs'): Renovation => ({ ...value, depth: { ...EMPTY_DEPTH, costs: kind === 'costs' ? [{ ...cost, ...patch } as CostRecord] : [cost], evidence: kind === 'evidence' ? [{ ...photo, ...patch } as Evidence] : [photo] } });

describe('renovation records without a room (ADR-0029)', () => {
	it('names a context by its room, or by its own target when it has none', () => {
		expect(contextOf({ roomId: room, targetId: 'wall-a' })).toBe(room);
		expect(contextOf({ targetId: 'wall-a' })).toBe('wall-a');
		expect(spatialContexts({ ...work, links: [{ roomId: room, targetId: room }] })).toEqual([{ roomId: 'wall-a', targetId: 'wall-a' }, { roomId: room, targetId: room }]);
		expect(hasRoomContext(work, 'wall-a')).toBe(true);
		expect(hasRoomContext(work, room)).toBe(false);
	});
	it('accepts every record kind on a wall that bounds no room', () => {
		expect(validateRenovation(value).ok).toBe(true);
		expect(validateRenovationTargets(value, context).ok).toBe(true);
		expect(reviewRenovation(value)[0]).toEqual({ kind: 'decision', roomId: undefined, recordId: 'decision-wall', causes: ['Lime or cement?'] });
	});
	it('refuses an empty room id, a room-less record on a zone, and a room-less record on nothing', () => {
		expect(validateRenovation({ ...value, subjects: [{ ...subject, roomId: '' }] }).ok).toBe(false);
		expect(validateRenovationTargets({ ...EMPTY_RENOVATION, subjects: [{ ...subject, id: 'detail-room', targetId: room, kind: 'floor' }] }, context)).toMatchObject({ ok: false, error: { code: 'renovation.room-missing' } });
		expect(validateRenovationTargets({ ...EMPTY_RENOVATION, work: [{ ...work, targetId: 'wall-gone', outcomes: [] }] }, context).ok).toBe(false);
	});
	it('refuses a pin on a photo with no room, because a pin is a fraction of a room box', () => {
		expect(validateRenovation(withDepth({ pin: { x: 0.5, y: 0.5 } }, 'evidence')).ok).toBe(false);
	});
	it('links costs and photos to a room-less Work item or subject on the same target only', () => {
		expect(validateRenovation(withDepth({ targetId: 'wall-b' }, 'costs')).ok).toBe(false);
		expect(validateRenovation(withDepth({ targetId: 'wall-b' }, 'evidence')).ok).toBe(false);
		expect(validateRenovation({ ...value, decisions: [{ ...value.decisions[0], subjectId: 'missing' }] }).ok).toBe(false);
	});
	it('still requires a secondary link to name a present room', () => {
		expect(validateRenovationTargets({ ...value, work: [{ ...work, links: [{ roomId: room, targetId: room }] }] }, context).ok).toBe(true);
		expect(validateRenovationTargets({ ...value, work: [{ ...work, links: [{ roomId: 'wall-b', targetId: 'wall-b' }] }] }, context).ok).toBe(false);
	});
	it('lists room-less records when their wall is about to be deleted', () => {
		expect(renovationReferents(value, 'wall-a')).toEqual(expect.arrayContaining(['Mortar', 'Before', 'Rendered brick', 'Repoint']));
	});
});
