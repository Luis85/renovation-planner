import { describe, expect, it } from 'vitest';
import { InMemoryAssetRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { assetRepositoryContract } from '../../../contracts/asset-repository.contract';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';

function fresh<T>(used: Set<T>, mint: () => T): T {
	let id = mint();
	while (used.has(id)) {
		id = mint();
	}
	used.add(id);
	return id;
}

assetRepositoryContract(() => {
	const repository = new InMemoryAssetRepository();
	const usedProjects = new Set<ProjectId>();
	return {
		repository,
		touch: (id) => repository.poke(id),
		otherProject: () => fresh(usedProjects, createProjectId),
	};
});

describe('InMemoryAssetRepository extras', () => {
	it('poke on an unknown id changes nothing and fails nothing', () => {
		const repository = new InMemoryAssetRepository();
		expect(() => repository.poke(createAssetId())).not.toThrow();
	});
});
