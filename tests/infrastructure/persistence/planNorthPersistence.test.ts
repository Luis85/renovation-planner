import { describe, expect, it } from 'vitest';
import { planFromPersistence, planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { toPlanDto } from '../../../src/presentation/read-models/PlanDto';
import { createRepositoryStack } from '../../helpers/vault';
import { expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';

describe('plan north persistence', () => {
	it('writes v10 with a north key only when one is set, and reads it back', () => {
		const project = makeProject();
		const detail = makePlan({ projectId: project.id, north: 45, parent: { planId: makePlan({ projectId: project.id }).id, zoneId: 'zone-1' as never } });
		const raw = planToPersistence(detail, 1);
		expect(raw).toMatchObject({ 'schema-version': 10, north: 45 });
		expect(expectOk(planFromPersistence(raw, null)).north).toBe(45);
		expect(toPlanDto(detail).north).toBe(45);
		const plain = makePlan({ projectId: project.id });
		expect('north' in planToPersistence(plain, 1)).toBe(false);
		expect('north' in toPlanDto(plain)).toBe(false);
	});

	it('reads a hand-edited bearing outside the vocabulary as no north, rather than refusing the note', () => {
		const raw = { ...planToPersistence(makePlan({ projectId: makeProject().id, north: 45 }), 1), north: 400 };
		expect(expectOk(planFromPersistence(raw, null)).north).toBeUndefined();
	});

	it('round-trips through the Obsidian repository, and a v9 note still reads with no north', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		expectOk(await stack.projects.save(project, 'absent'));
		const site = makePlan({ projectId: project.id, name: 'Site' });
		const house = makePlan({ projectId: project.id, name: 'House', north: 270, parent: { planId: site.id, zoneId: 'zone-1' as never } });
		expectOk(await stack.plans.save(site, 'absent'));
		expectOk(await stack.plans.save(house, 'absent'));
		expect(expectFound(await stack.plans.getById(house.id)).entity.north).toBe(270);
		expect(expectFound(await stack.plans.getById(site.id)).entity.north).toBeUndefined();
	});
});
