import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { assetPriceOverrideRepositoryContract } from '../../contracts/asset-price-override-repository.contract';

// The in-memory side provisions nothing, so its fixture mints ids directly — which is exactly
// the shape that does NOT work for the note-backed one, and the reason the contract asks the
// fixture rather than minting them itself.
assetPriceOverrideRepositoryContract(() => {
	const repository = new InMemoryAssetPriceOverrideRepository();
	return {
		repository,
		touch: (id) => repository.poke(id),
		newProject: () => createProjectId(),
		newAsset: () => createAssetId(),
	};
});
