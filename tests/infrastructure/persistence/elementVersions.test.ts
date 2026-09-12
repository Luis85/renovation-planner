import { describe, expect, it } from 'vitest';
import { makeAsset, makePlan, makeProject, makeRequirement } from '../../helpers/entities';
import { expectOk } from '../../helpers/domain';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import { withPlanSpatialElements } from '../../../src/domain/plan/Plan';
import { planToPersistence, planFromPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { requirementToPersistence, requirementFromPersistence } from '../../../src/infrastructure/persistence/mappers/requirementMapper';
import { MigrationRunner } from '../../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';
import { REQUIREMENT_MIGRATIONS } from '../../../src/infrastructure/persistence/migration/entities/requirement/requirement.migrations';
import type { RequirementSource } from '../../../src/domain/requirement/RequirementSource';
import { EMPTY_RENOVATION } from '../../../src/domain/renovation/Renovation';

describe('conditional element persistence versions protect older writers', () => {
	it('round-trips labels and shared links together, returning to v5 when the last element is undone', () => {
		const project = makeProject(), roomId = createZoneId();
		const work = { id: 'work-survey', roomId, targetId: roomId, title: 'Survey', description: '', order: 0, progress: 'pending' as const, responsibility: 'unassigned' as const, outcomes: [], dependencies: [], links: [{ roomId, targetId: 'wall-a' }] };
		const original = makePlan({ projectId: project.id, renovation: { ...EMPTY_RENOVATION, work: [work] } });
		const plan = expectOk(withPlanSpatialElements(original, [{ id: 'element-fence', name: 'Boundary' }]));
		const dto = planToPersistence(plan, 7);
		expect(dto['schema-version']).toBe(6);
		expect(dto['spatial-elements']).toEqual(plan.spatialElements);
		const restored = expectOk(planFromPersistence(dto, null));
		expect(restored.spatialElements).toEqual(plan.spatialElements); expect(restored.renovation).toEqual(original.renovation);
		expect(planToPersistence(expectOk(withPlanSpatialElements(restored, [])), 8)['schema-version']).toBe(5);
		const old = new MigrationRunner(); old.registerAll('plan', PLAN_MIGRATIONS.filter(step => step.toVersion <= 5));
		expect(() => old.migrateToLatest('plan', dto, 6)).toThrow('newer than this build supports');
	});
	it.each(['element-length', 'object-area'] as const)('round-trips %s without silently downgrading its provenance', rule => {
		const project = makeProject(), asset = makeAsset(), roomId = createZoneId();
		const source: RequirementSource = { planId: 'plan', targetId: 'element-boundary', workId: '', outcomeId: '', state: 'intended', rule, manual: '0', coverage: '1', lot: '', minimum: '' };
		const requirement = makeRequirement({ projectId: project.id, assetId: asset.id, origin: { kind: 'zone', zoneId: roomId }, source });
		const dto = requirementToPersistence(requirement, 2);
		expect(dto['schema-version']).toBe(3); expect(expectOk(requirementFromPersistence(dto)).source).toEqual(source);
		const old = new MigrationRunner(); old.registerAll('requirement', REQUIREMENT_MIGRATIONS.filter(step => step.toVersion <= 2));
		expect(() => old.migrateToLatest('requirement', dto, 3)).toThrow('newer than this build supports');
	});
	it('writes a placement-count source at schema 4 and refuses it to a schema-3 reader as newer', () => {
		const requirement = makeRequirement({ projectId: makeProject().id, assetId: makeAsset().id, origin: { kind: 'zone', zoneId: createZoneId() },
			source: { planId: 'plan', targetId: 'room', workId: '', outcomeId: '', state: 'current', rule: 'placement-count', manual: '0', coverage: '1', lot: '', minimum: '' } });
		const dto = requirementToPersistence(requirement, 2);
		expect(dto['schema-version']).toBe(4); expect(expectOk(requirementFromPersistence(dto)).source?.rule).toBe('placement-count');
		const old = new MigrationRunner(); old.registerAll('requirement', REQUIREMENT_MIGRATIONS.filter(step => step.toVersion <= 3));
		expect(() => old.migrateToLatest('requirement', dto, 4)).toThrow('newer than this build supports');
	});
});
