import { describe, expect, it } from 'vitest';
import {
	resolveEffectiveUnitCost,
	effectiveUnitCostFrom,
} from '../../../../src/application/commands/requirement/resolveEffectiveUnitCost';
import { InMemoryAssetPriceOverrideRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import type { AssetPriceOverrideRepository } from '../../../../src/application/ports/AssetPriceOverrideRepository';
import { AssetPriceOverride } from '../../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../../src/domain/asset-price/AssetPriceOverrideId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { of as moneyOf } from '../../../../src/core/money/Money';
import { expectOk, injectedReadFailure } from '../../../helpers/domain';

function makeOverride(projectId: ReturnType<typeof createProjectId>, assetId: ReturnType<typeof createAssetId>) {
	return expectOk(
		AssetPriceOverride.create({
			id: createAssetPriceOverrideId(),
			projectId,
			assetId,
			unitCost: moneyOf('19.50', 'GBP'),
		}),
	);
}

/** A repository whose `getForPair` always answers a failed read; every other member is unused. */
function failingOverrides(): AssetPriceOverrideRepository {
	return {
		getForPair: () => Promise.resolve(injectedReadFailure()),
		listByProject: () => {
			throw new Error('not used by this test');
		},
		listByAsset: () => {
			throw new Error('not used by this test');
		},
		save: () => {
			throw new Error('not used by this test');
		},
		delete: () => {
			throw new Error('not used by this test');
		},
	};
}

describe('resolveEffectiveUnitCost', () => {
	it('answers the asset default when the project has no override', async () => {
		const overrides = new InMemoryAssetPriceOverrideRepository();
		const projectId = createProjectId();
		const asset = { id: createAssetId(), unitCost: moneyOf('45.00', 'EUR') };

		const result = expectOk(await resolveEffectiveUnitCost(overrides, projectId, asset));

		expect(result.amount).toBe('45');
		expect(result.currency).toBe('EUR');
	});

	it('answers the project override when there is one', async () => {
		const overrides = new InMemoryAssetPriceOverrideRepository();
		const projectId = createProjectId();
		const asset = { id: createAssetId(), unitCost: moneyOf('45.00', 'EUR') };
		expectOk(await overrides.save(makeOverride(projectId, asset.id), 'absent'));

		const result = expectOk(await resolveEffectiveUnitCost(overrides, projectId, asset));

		expect(result.amount).toBe('19.5');
		expect(result.currency).toBe('GBP');
	});

	/**
	 * A read that FAILED is not the same as a pair with no override. Falling back would
	 * price the requirement at the catalogue default on a vault I/O fault, silently.
	 */
	it('propagates a failed override read rather than falling back to the default', async () => {
		const overrides = failingOverrides();
		const projectId = createProjectId();
		const asset = { id: createAssetId(), unitCost: moneyOf('45.00', 'EUR') };

		const result = await resolveEffectiveUnitCost(overrides, projectId, asset);

		expect(result.ok).toBe(false);
	});
});

describe('effectiveUnitCostFrom', () => {
	it('answers the map entry for the project, and the asset default for a project not in it', () => {
		const projectId = createProjectId();
		const otherProjectId = createProjectId();
		const asset = { unitCost: moneyOf('45.00', 'EUR') };
		const overridesByProject = new Map([[projectId, moneyOf('19.50', 'GBP')]]);

		expect(effectiveUnitCostFrom(overridesByProject, projectId, asset).amount).toBe('19.5');
		expect(effectiveUnitCostFrom(overridesByProject, projectId, asset).currency).toBe('GBP');
		expect(effectiveUnitCostFrom(overridesByProject, otherProjectId, asset).amount).toBe('45');
		expect(effectiveUnitCostFrom(overridesByProject, otherProjectId, asset).currency).toBe('EUR');
	});
});
