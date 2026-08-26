import { describe, expect, it } from 'vitest';
import { InMemoryRequirementRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryRequirementRepository';
import { requirementRepositoryContract } from '../../../contracts/requirement-repository.contract';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';

function fresh<T>(used: Set<T>, mint: () => T): T {
	let id = mint();
	while (used.has(id)) {
		id = mint();
	}
	used.add(id);
	return id;
}

requirementRepositoryContract(() => {
	const repository = new InMemoryRequirementRepository();
	const usedProjects = new Set<ProjectId>();
	return {
		repository,
		touch: (id) => repository.poke(id),
		otherProject: () => fresh(usedProjects, createProjectId),
		newZone: () => createZoneId(),
		newAsset: () => createAssetId(),
	};
});

describe('InMemoryRequirementRepository extras', () => {
	it('poke on an unknown id changes nothing and fails nothing', () => {
		const repository = new InMemoryRequirementRepository();
		expect(() => repository.poke(createZoneId())).not.toThrow();
	});
});
