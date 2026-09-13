import { describe, expect, it } from 'vitest';
import { makePlan, makeProject } from '../../helpers/entities';
import { expectOk } from '../../helpers/domain';
import { planToPersistence, planFromPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';
import { EMPTY_DEPTH } from '../../../src/domain/renovation/PlanningDepth';
import type { Renovation } from '../../../src/domain/renovation/Renovation';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { of } from '../../../src/core/money/Money';

const roomless: Renovation = {
	subjects: [{ id: 'detail-wall', targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good' }, planned: { change: 'modify', description: 'Rendered brick' } }],
	work: [{ id: 'work-wall', targetId: 'wall-a', title: 'Render', description: '', order: 0, progress: 'pending', responsibility: 'diy', outcomes: ['detail-wall'], dependencies: [] }],
	decisions: [{ id: 'decision-wall', subjectId: 'detail-wall', question: 'Which render?', resolution: '', resolved: false }],
	depth: { ...EMPTY_DEPTH,
		costs: [{ id: 'cost-wall', targetId: 'wall-a', workId: 'work-wall', title: 'Render', category: 'other', requirementId: '', planned: of('90', 'EUR'), facts: [], cancelled: false }],
		evidence: [{ id: 'photo-wall', targetId: 'wall-a', workId: '', description: 'Before', type: 'photo', phase: 'before', path: 'wall.jpg', subpath: '', recordId: '', pin: null }],
		procurement: [{ id: 'buy-wall', targetId: 'wall-a', workId: '', requirementId: 'requirement-render', unit: 'm2', purchased: '0', reserved: '0' }] },
};

/** 12, not 11: ADR-0029 took plan schema 11 for a plan's kind and sibling order, and 12 extends it. */
describe('plan note schema 12 keeps records without a room from older writers', () => {
	it('round-trips every room-less record kind at schema 12', () => {
		const plan = makePlan({ projectId: makeProject().id, renovation: roomless });
		const dto = planToPersistence(plan, 3);
		expect(dto['schema-version']).toBe(12);
		expect(expectOk(planFromPersistence(dto, null)).renovation).toEqual(roomless);
	});
	it('writes what it wrote before when every record has a room', () => {
		const roomId = createZoneId();
		const plan = makePlan({ projectId: makeProject().id, renovation: { subjects: [{ id: 'detail', roomId, targetId: roomId, kind: 'floor', existing: { description: 'Tiles', condition: 'good' }, planned: null }], work: [], decisions: [] } });
		expect(planToPersistence(plan, 3)['schema-version']).toBe(3);
	});
	it('is refused by a schema-11 reader as newer, not as corrupt', () => {
		const dto = planToPersistence(makePlan({ projectId: makeProject().id, renovation: roomless }), 3);
		const old = new MigrationRunner(); old.registerAll('plan', PLAN_MIGRATIONS.filter(step => step.toVersion <= 11));
		expect(() => old.migrateToLatest('plan', dto, 12)).toThrow('newer than this build supports');
	});
	it('writes a subject material at schema 12 even when the subject has a room', () => {
		const roomId = createZoneId();
		const plan = makePlan({ projectId: makeProject().id, renovation: { subjects: [{ id: 'detail', roomId, targetId: 'wall-a', kind: 'wall', existing: { description: 'Brick', condition: 'good', assetId: 'asset-brick' }, planned: null }], work: [], decisions: [] } });
		const dto = planToPersistence(plan, 3);
		expect(dto['schema-version']).toBe(12);
		expect(expectOk(planFromPersistence(dto, null)).renovation?.subjects[0].existing?.assetId).toBe('asset-brick');
	});
	it('writes 12, not 11, when the plan also carries a kind and order, and round-trips all three', () => {
		const plan = makePlan({ projectId: makeProject().id, kind: 'room', order: 3, renovation: roomless });
		const dto = planToPersistence(plan, 3);
		expect(dto).toMatchObject({ 'schema-version': 12, kind: 'room', order: 3 });
		const read = expectOk(planFromPersistence(dto, null));
		expect(read).toMatchObject({ kind: 'room', order: 3 });
		expect(read.renovation).toEqual(roomless);
	});
});
