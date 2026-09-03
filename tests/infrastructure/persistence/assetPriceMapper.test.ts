import { describe, expect, it } from 'vitest';
import {
	assetPriceFromPersistence,
	assetPriceToPersistence,
} from '../../../src/infrastructure/persistence/mappers/assetPriceMapper';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/domain';

function override(amount = '19.50') {
	return expectOk(
		AssetPriceOverride.create({
			id: createAssetPriceOverrideId(),
			projectId: createProjectId(),
			assetId: createAssetId(),
			unitCost: moneyOf(amount, 'GBP'),
		}),
	);
}

describe('assetPriceMapper', () => {
	it('writes the owned keys and reads them back unchanged', () => {
		const entity = override();
		const dto = assetPriceToPersistence(entity, 3);
		expect(dto).toMatchObject({
			type: 'renovation-asset-price',
			'schema-version': 1,
			id: entity.id,
			revision: 3,
			project: entity.projectId,
			asset: entity.assetId,
			// `assetPriceToPersistence` writes `entity.unitCost.amount` verbatim — the mapper
			// preserves spelling. The ENTITY's own amount is already normalized, though: `override()`
			// mints through `moneyOf` (Task 1's normalization note), so '19.50' is '19.5' by the
			// time it reaches this DTO. "Reads back unchanged" below is still the mapper's own
			// round trip — it does not restore the trailing zero `moneyOf` already dropped.
			'unit-cost': '19.5',
			currency: 'GBP',
		});

		const read = expectOk(assetPriceFromPersistence(dto));
		expect(read.id).toBe(entity.id);
		expect(read.projectId).toBe(entity.projectId);
		expect(read.assetId).toBe(entity.assetId);
		expect(read.unitCost.amount).toBe('19.5');
	});

	/** A YAML float is exactly what ADR-010 refuses; three decimals is what catches one. */
	it('preserves a three-decimal amount through both directions', () => {
		const dto = assetPriceToPersistence(override('594.005'), 1);
		expect(dto['unit-cost']).toBe('594.005');
		expect(expectOk(assetPriceFromPersistence(dto)).unitCost.amount).toBe('594.005');
	});

	it('refuses a note whose amount is a YAML float rather than a string', () => {
		const dto = { ...assetPriceToPersistence(override(), 1), 'unit-cost': 19.5 };
		expect(assetPriceFromPersistence(dto).ok).toBe(false);
	});

	it('refuses a note whose currency is not ISO-4217 shaped', () => {
		const dto = { ...assetPriceToPersistence(override(), 1), currency: 'pounds' };
		expect(assetPriceFromPersistence(dto).ok).toBe(false);
	});

	/**
	 * Spec Decision 2, pinned as behaviour: a note that disagrees with its project's currency
	 * is READ, not refused. A build that starts refusing it here makes a file the user can see
	 * on disk invisible to the plugin — unlistable, unclearable, and with nothing saying why —
	 * so this case is what stops that being "tightened" back in.
	 */
	it('reads a note whose currency is not the project currency, so it can be shown', () => {
		const dto = { ...assetPriceToPersistence(override(), 1), 'unit-cost': '24.00', currency: 'EUR' };
		const read = expectOk(assetPriceFromPersistence(dto));
		expect(read.unitCost.currency).toBe('EUR');
	});
});
