import { describe, expect, it } from 'vitest';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { of as moneyOf } from '../../../src/core/money/Money';
import { expectOk } from '../../helpers/domain';

function props() {
	return {
		id: createAssetPriceOverrideId(),
		projectId: createProjectId(),
		assetId: createAssetId(),
		unitCost: moneyOf('19.50', 'GBP'),
	};
}

describe('AssetPriceOverride', () => {
	it('is created from a project, an asset and a price', () => {
		const created = expectOk(AssetPriceOverride.create(props()));
		// `of()` mints through `Decimal.dp()` (no `places` argument), which drops a
		// trailing zero — unlike `createMoney`, which preserves the input string
		// verbatim. '19.50' therefore normalizes to '19.5'; see
		// `tests/core/money/moneyArithmetic.test.ts`'s `sameAmount` helper, which exists
		// for exactly this reason.
		expect(created.unitCost.amount).toBe('19.5');
		expect(created.unitCost.currency).toBe('GBP');
	});

	/**
	 * The entity does NOT police the project's currency — that is the command's (Task 4), and
	 * this case pins the absence so a later author does not "fix" it back onto the constructor
	 * and silently make every stranded note unreadable.
	 */
	it('accepts a unit cost in any currency, because the project is not its fact', () => {
		const created = expectOk(AssetPriceOverride.create({ ...props(), unitCost: moneyOf('19.50', 'EUR') }));
		expect(created.unitCost.currency).toBe('EUR');
	});

	it('refuses a negative unit cost', () => {
		const result = AssetPriceOverride.create({ ...props(), unitCost: moneyOf('-1.00', 'GBP') });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.negative-unit-cost');
	});

	/** Zero is a real price — a supplier throwing in offcuts free of charge is not an error. */
	it('accepts a zero unit cost', () => {
		const created = expectOk(AssetPriceOverride.create({ ...props(), unitCost: moneyOf('0.00', 'GBP') }));
		// See the normalization note above: `of('0.00', ...)` mints '0', not '0.00'.
		expect(created.unitCost.amount).toBe('0');
	});

	/** `withUnitCost` rebuilds through `create`, so every edit re-runs the refusal. */
	it('re-validates on edit and keeps identity', () => {
		const created = expectOk(AssetPriceOverride.create(props()));
		const edited = expectOk(created.withUnitCost(moneyOf('21.00', 'GBP')));
		expect(edited.id).toBe(created.id);
		expect(edited.projectId).toBe(created.projectId);
		expect(edited.assetId).toBe(created.assetId);
		// See the normalization note above: `of('21.00', ...)` mints '21', not '21.00'.
		expect(edited.unitCost.amount).toBe('21');

		const refused = created.withUnitCost(moneyOf('-1.00', 'GBP'));
		expect(refused.ok).toBe(false);
	});
});
