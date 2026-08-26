import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { makeAsset, makeRequirement } from '../../../helpers/entities';
import { expectErr, expectOk } from '../../../helpers/domain';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { of as moneyOf } from '../../../../src/core/money/Money';
import {
	assetToPersistence,
	assetFromPersistence,
} from '../../../../src/infrastructure/persistence/mappers/assetMapper';
import {
	requirementToPersistence,
	requirementFromPersistence,
} from '../../../../src/infrastructure/persistence/mappers/requirementMapper';

/**
 * The mapper arms the contract suite's plain entities never reach: overrides PRESENT on
 * a persisted requirement (both derived fields), and an Asset whose waste default is
 * persisted as null.
 */

describe('requirement override round trip', () => {
	it('persists and restores BOTH overrides as values, not absences', () => {
		const requirement = makeRequirement({
			projectId: createProjectId(),
			assetId: 'asset-x' as never,
			origin: { kind: 'zone', zoneId: createZoneId() },
		});
		const withQuantity = expectOk(
			requirement.withQuantityOverride({ value: new Decimal('7.5'), unit: 'm2' }),
		);
		const withBoth = expectOk(withQuantity.withCostOverride(moneyOf('99.99', 'EUR')));

		const dto = requirementToPersistence(withBoth, 4);
		expect(dto['quantity-override']).toBe('7.5');
		expect(dto['cost-override']).toBe('99.99');

		const restored = expectOk(requirementFromPersistence(dto));
		expect(restored.quantity.override?.value.toString()).toBe('7.5');
		expect(restored.quantity.override?.unit).toBe('m2');
		expect(restored.estimatedCost.override?.amount).toBe('99.99');
		// The calculated figures ride through untouched beside their overrides.
		expect(restored.quantity.calculated.value.toString()).toBe(
			withBoth.quantity.calculated.value.toString(),
		);
	});
});

describe('asset null-waste persistence', () => {
	it('a null default survives the schema and re-validates', () => {
		const dto = assetToPersistence(makeAsset({ projectId: createProjectId() }), 1);
		dto['waste-factor-default'] = null;
		const parsed = expectOk(assetFromPersistence({ ...dto }));
		expect(parsed.wasteFactorDefault.toString()).toBe('0');
	});

	it('a default outside [0, 1] fails the entity validation after the schema', () => {
		const dto = assetToPersistence(makeAsset({ projectId: createProjectId() }), 1);
		dto['waste-factor-default'] = '2';
		const error = expectErr(assetFromPersistence({ ...dto }));
		expect(error.code).toBe('asset.waste-factor-default-above-one');
	});
});
