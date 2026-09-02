import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { Asset, type CreateAssetProps } from '../../../src/domain/asset/Asset';
import { Requirement, type CreateRequirementProps } from '../../../src/domain/requirement/Requirement';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createZoneId } from '../../../src/domain/zone/ZoneId';
import {
	createRequirementId,
} from '../../../src/domain/requirement/RequirementId';
import { of as moneyOf } from '../../../src/core/money/Money';
import { expectErr, expectOk } from '../../helpers/domain';

/**
 * The smart-constructor refusals no command reaches: a persisted `recalculationStatus`
 * or ISO date a hand-edited note can carry is refused at construction, and a waste
 * fraction outside [0, 1] names its own field.
 */

const projectId = createProjectId();
const assetId = createAssetId();

function assetProps(overrides?: Partial<CreateAssetProps>): Parameters<typeof Asset.create>[0] {
	return {
		id: assetId,
		name: 'Tile',
		category: 'material',
		unit: 'm2',
		unitCost: moneyOf('45.00', 'EUR'),
		wasteFactorDefault: new Decimal('0.10'),
		supplier: null,
		sku: null,
		notes: null,
		...overrides,
	};
}

function requirementProps(
	overrides?: Partial<CreateRequirementProps>,
): CreateRequirementProps {
	return {
		id: createRequirementId(),
		projectId,
		assetId,
		origin: { kind: 'zone', zoneId: createZoneId() },
		unit: 'm2',
		wasteFactor: new Decimal('0.10'),
		quantity: { calculated: { value: new Decimal(10), unit: 'm2' } },
		estimatedCost: { calculated: moneyOf('450.00', 'EUR') },
		calculatedFrom: {
			zoneArea: { value: new Decimal(10), unit: 'm2' },
			unitCost: moneyOf('45.00', 'EUR'),
			assetUnit: 'm2',
		},
		...overrides,
	};
}

describe('Requirement.create refusals', () => {
	it('refuses an origin kind this version does not read', () => {
		const error = expectErr(
			Requirement.create(
				// ONE cast over the whole origin rather than one per field: this is deliberately a
				// shape from a version that reads work packages, and `workPackageId` is excess on
				// today's type. Casting the fields individually left the object literal itself
				// failing excess-property checking, which said nothing about intent.
				requirementProps({ origin: { kind: 'work-package', workPackageId: 'wp-1' } as never }),
			),
		);
		expect(error.code).toBe('requirement.unknown-origin-kind');
	});

	it('refuses an unknown recalculation status', () => {
		const error = expectErr(
			// A hand-edited note can carry anything; the constructor is where it stops.
			Requirement.create(requirementProps({ recalculationStatus: 'checked' as never })),
		);
		expect(error.code).toBe('requirement.unknown-status');
	});

	it('refuses a requiredDate that is not an ISO date', () => {
		const error = expectErr(
			Requirement.create(requirementProps({ requiredDate: 'next tuesday' as never })),
		);
		expect(error.code).toBe('requirement.invalid-required-date');
	});

	it('accepts a valid ISO date and answers it', () => {
		const requirement = expectOk(
			Requirement.create(requirementProps({ requiredDate: '2026-09-01' })),
		);
		expect(requirement.requiredDate).toBe('2026-09-01');
	});

	it('withWasteFactor re-validates the field under its own name', () => {
		const requirement = expectOk(Requirement.create(requirementProps()));
		expect(expectOk(requirement.withWasteFactor(new Decimal('0.25'))).wasteFactor.toString()).toBe('0.25');
		const error = expectErr(requirement.withWasteFactor(new Decimal('-0.01')));
		expect(error.code).toBe('requirement.negative-waste-factor');
	});
});

describe('Asset.create waste-fraction refusals', () => {
	it('refuses a default above one with the field named', () => {
		const error = expectErr(Asset.create(assetProps({ wasteFactorDefault: new Decimal('2') })));
		expect(error.code).toBe('asset.waste-factor-default-above-one');
	});

	it('isAreaKind reads the unit KIND, not the symbol', () => {
		expect(expectOk(Asset.create(assetProps())).isAreaKind()).toBe(true);
		expect(
			expectOk(Asset.create(assetProps({ unit: 'piece' }))).isAreaKind(),
		).toBe(false);
	});
});

describe('Asset.withChanges field-presence semantics', () => {
	const asset = expectOk(Asset.create(assetProps()));

	it('a PRESENT field replaces its value even when that value is null', () => {
		const cleared = expectOk(
			asset.withChanges({ supplier: null, sku: null, notes: null }),
		);
		expect(cleared.supplier).toBeNull();
		expect(cleared.sku).toBeNull();
		expect(cleared.notes).toBeNull();

		const set = expectOk(
			asset.withChanges({ supplier: 'Acme', sku: 'SKU-1', notes: 'keep' }),
		);
		expect(set.supplier).toBe('Acme');
		expect(set.sku).toBe('SKU-1');
		expect(set.notes).toBe('keep');
	});

	it('an ABSENT field keeps the previous value', () => {
		const edited = expectOk(asset.withChanges({ name: 'Renamed' }));
		expect(edited.name).toBe('Renamed');
		expect(edited.supplier).toBe(asset.supplier);
		expect(edited.sku).toBe(asset.sku);
		expect(edited.notes).toBe(asset.notes);
	});
});

describe('Requirement.withRecalculation preserves the cost override, not the quantity one', () => {
	/**
	 * The class header's own invariant — an override is a user's answer sitting BESIDE a
	 * derived figure, never a claim about the derivation — applies to a FULL recalculation
	 * exactly as it already applies to `withCalculatedCost`'s narrower quantity-override
	 * trigger. Found by the per-project price override increment's own precedence case: a
	 * price change recalculating `calculated` was silently discarding a negotiated
	 * `estimatedCost.override` on every cascade run.
	 */
	it('keeps a cost override across a full recalculation that moves the calculated figure', () => {
		const withOverride = expectOk(
			Requirement.create(requirementProps()),
		).withCostOverride(moneyOf('500.00', 'EUR'));
		const requirement = expectOk(withOverride);

		const recalculated = expectOk(
			requirement.withRecalculation(
				{ value: new Decimal(12), unit: 'm2' },
				moneyOf('550.00', 'EUR'),
				requirement.calculatedFrom,
			),
		);

		expect(recalculated.estimatedCost.calculated.amount).toBe('550');
		expect(recalculated.estimatedCost.override?.amount).toBe('500');
	});

	/**
	 * **RECORDED RESIDUAL, not desired behaviour.** A quantity override does NOT survive a
	 * full recalculation — deliberately reverted to `main`'s pre-existing behaviour after a
	 * review bot found that preserving it (as `withRecalculation` briefly did) decouples the
	 * override from the cost: `deriveRequirementFigures` prices from the CALCULATED quantity
	 * always, never the effective one, so a kept `quantity.override` of 9 m² would sit beside
	 * an `estimatedCost.calculated` priced at the recalculated 12 m², with nothing saying the
	 * two no longer agree. Dropping the override on recalculation is lossy, and it is at least
	 * internally consistent — both figures speak of 12.
	 *
	 * The real fix is not this method preserving the override — it is re-pricing from the
	 * EFFECTIVE quantity, the way `SetRequirementQuantityOverride`'s own docblock already
	 * states the rule ("then re-runs the Cost Pipeline against the new EFFECTIVE quantity").
	 * That is a change to what a full recalculation MEANS and needs its own cases; it does not
	 * belong inside a price-override increment. **A future fix along those lines should REDDEN
	 * this case** — read this docblock rather than treating a red result here as a regression.
	 */
	it('drops a quantity override across a full recalculation — a recorded residual, not a design', () => {
		const requirement = expectOk(
			expectOk(Requirement.create(requirementProps())).withQuantityOverride({
				value: new Decimal(9),
				unit: 'm2',
			}),
		);

		const recalculated = expectOk(
			requirement.withRecalculation(
				{ value: new Decimal(12), unit: 'm2' },
				moneyOf('550.00', 'EUR'),
				requirement.calculatedFrom,
			),
		);

		expect(recalculated.quantity.calculated.value.toNumber()).toBe(12);
		expect(recalculated.quantity.override).toBeUndefined();
	});

	/** With no override set on either side, a recalculation still leaves neither one present. */
	it('leaves both overrides absent when neither was set', () => {
		const requirement = expectOk(Requirement.create(requirementProps()));

		const recalculated = expectOk(
			requirement.withRecalculation(
				{ value: new Decimal(12), unit: 'm2' },
				moneyOf('550.00', 'EUR'),
				requirement.calculatedFrom,
			),
		);

		expect(recalculated.quantity.override).toBeUndefined();
		expect(recalculated.estimatedCost.override).toBeUndefined();
	});
});
