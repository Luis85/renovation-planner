import { describe, expect, it } from 'vitest';
import { planFromPersistence, planToPersistence } from '../../../src/infrastructure/persistence/mappers/planMapper';
import { createPlanId } from '../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { toPlanDto } from '../../../src/presentation/read-models/PlanDto';
import { createRepositoryStack } from '../../helpers/vault';
import { expectErr, expectFound, expectOk } from '../../helpers/domain';
import { makePlan, makeProject } from '../../helpers/entities';

const HOUSE_ZONE = 'zone-house' as ZoneId;

describe('plan parent persistence (ADR-0028)', () => {
	it('writes v9 with both parent keys only for a detail plan, and reads them back', () => {
		const project = makeProject();
		const site = makePlan({ projectId: project.id, name: 'Site' });
		const house = makePlan({ projectId: project.id, name: 'House', parent: { planId: site.id, zoneId: HOUSE_ZONE } });
		const raw = planToPersistence(house, 1);
		expect(raw).toMatchObject({ 'schema-version': 9, 'parent-plan': site.id, 'parent-zone': HOUSE_ZONE });
		expect(planToPersistence(site, 1)['schema-version']).toBe(1);
		expect('parent-plan' in planToPersistence(site, 1)).toBe(false);
		expect(expectOk(planFromPersistence(raw, null)).parent).toEqual({ planId: site.id, zoneId: HOUSE_ZONE });
		expect(toPlanDto(house).parent).toEqual({ planId: site.id, zoneId: HOUSE_ZONE });
		expect('parent' in toPlanDto(site)).toBe(false);
	});

	it('refuses a note carrying only one half of the link', () => {
		const house = makePlan({ projectId: makeProject().id, parent: { planId: createPlanId(), zoneId: HOUSE_ZONE } });
		const raw = { ...planToPersistence(house, 1) };
		delete raw['parent-zone'];
		expect(expectErr(planFromPersistence(raw, null)).code).toBe('plan.frontmatter-invalid');
	});

	it('round-trips through the Obsidian repository', async () => {
		const stack = createRepositoryStack();
		const project = makeProject();
		expectOk(await stack.projects.save(project, 'absent'));
		const site = makePlan({ projectId: project.id, name: 'Site' });
		expectOk(await stack.plans.save(site, 'absent'));
		const house = makePlan({ projectId: project.id, name: 'House', parent: { planId: site.id, zoneId: HOUSE_ZONE } });
		expectOk(await stack.plans.save(house, 'absent'));
		expect(expectFound(await stack.plans.getById(house.id)).entity.parent).toEqual(house.parent);
	});
});
