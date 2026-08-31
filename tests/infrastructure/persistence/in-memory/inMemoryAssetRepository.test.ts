import { describe, expect, it } from 'vitest';
import { InMemoryAssetRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { assetRepositoryContract } from '../../../contracts/asset-repository.contract';
import { createAssetId } from '../../../../src/domain/asset/AssetId';

assetRepositoryContract(() => {
	const repository = new InMemoryAssetRepository();
	return {
		repository,
		touch: (id) => repository.poke(id),
	};
});

describe('InMemoryAssetRepository extras', () => {
	it('poke on an unknown id changes nothing and fails nothing', () => {
		const repository = new InMemoryAssetRepository();
		expect(() => repository.poke(createAssetId())).not.toThrow();
	});
});
