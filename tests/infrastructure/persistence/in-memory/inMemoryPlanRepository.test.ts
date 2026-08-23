import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { planRepositoryContract } from '../../../contracts/plan-repository.contract';
import { makePlan } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { describe, expect, it } from 'vitest';

// The identical suite slice 4 will run against the Obsidian-backed repository.
planRepositoryContract(() => {
	const repository = new InMemoryPlanRepository();
	return {
		repository,
		makePlan: (projectId, name = 'Ground floor') => makePlan({ projectId, name }),
		touch: (id) => repository.poke(id),
		otherProject: () => createProjectId(),
	};
});

describe('InMemoryPlanRepository extras', () => {
	it('poke on an unknown id changes nothing and fails nothing', () => {
		const repository = new InMemoryPlanRepository();
		expect(() => repository.poke(createPlanId())).not.toThrow();
	});
});
