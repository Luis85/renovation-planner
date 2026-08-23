import { describe, expect, it } from 'vitest';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { zoneRepositoryContract } from '../../../contracts/zone-repository.contract';
import { makeZone } from '../../../helpers/entities';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { createPlanId, type PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';

function fresh<T>(used: Set<T>, mint: () => T): T {
	let id = mint();
	while (used.has(id)) {
		id = mint();
	}
	used.add(id);
	return id;
}

// The identical suite slice 4 will run against the Obsidian-backed repository.
zoneRepositoryContract(() => {
	const repository = new InMemoryZoneRepository();
	const usedPlans = new Set<PlanId>();
	const usedProjects = new Set<ProjectId>();
	return {
		repository,
		makeZone: (projectId, planId, name = 'Living room') => makeZone({ projectId, planId, name }),
		touch: (id) => repository.poke(id),
		otherParents: () => ({
			projectId: fresh(usedProjects, createProjectId),
			planId: fresh(usedPlans, createPlanId),
		}),
		otherProject: () => fresh(usedProjects, createProjectId),
	};
});

describe('InMemoryZoneRepository extras', () => {
	it('poke on an unknown id changes nothing and fails nothing', () => {
		const repository = new InMemoryZoneRepository();
		expect(() => repository.poke(createZoneId())).not.toThrow();
	});
});