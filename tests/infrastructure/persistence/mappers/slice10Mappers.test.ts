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
		const dto = assetToPersistence(makeAsset(), 1);
		dto['waste-factor-default'] = null;
		const parsed = expectOk(assetFromPersistence({ ...dto }));
		expect(parsed.wasteFactorDefault.toString()).toBe('0');
	});

	it('a default outside [0, 1] fails the entity validation after the schema', () => {
		const dto = assetToPersistence(makeAsset(), 1);
		dto['waste-factor-default'] = '2';
		const error = expectErr(assetFromPersistence({ ...dto }));
		expect(error.code).toBe('asset.waste-factor-default-above-one');
	});
});

/**
 * Height (Task A7) — the one asset scalar in FRONTMATTER rather than in the geometry
 * sidecar, so the mapper is the whole of its persistence and both directions are asked here.
 *
 * No schema version bump is owed: `ASSET_MIGRATIONS` is empty, the version is derived from
 * the registered steps, and no release of this plugin exists — measured against the REMOTE
 * (`git ls-remote --tags origin` prints nothing), not against a clone's `main`, which says
 * only what this machine last fetched. So no vault anywhere holds an Asset note a build
 * predating this key could have written and this one has to migrate.
 */
describe('asset height persistence', () => {
	it('writes the height as a plain YAML number and restores it', () => {
		const dto = assetToPersistence(makeAsset({ height: 900 }), 1);
		expect(dto['height']).toBe(900);
		expect(expectOk(assetFromPersistence({ ...dto })).height).toBe(900);
	});

	/**
	 * The read half of the additive-key promise: a note written before this key existed has
	 * no `height` at all, and reads as an asset that says nothing about how tall it is rather
	 * than as a note this build refuses.
	 */
	it('reads a note with no height key at all as an asset with no height', () => {
		const dto = assetToPersistence(makeAsset(), 1);
		delete dto['height'];
		expect(expectOk(assetFromPersistence(dto)).height).toBeNull();
	});

	/**
	 * `.catch(null)` is a SHAPE rule and it is the whole of what the schema can promise: a
	 * hand edit that typed a word where a number goes reads as no height rather than taking
	 * the catalogue entry down with it.
	 */
	it('reads a height that is not a number as no height, rather than refusing the note', () => {
		const dto = assetToPersistence(makeAsset(), 1);
		dto['height'] = 'quite tall';
		expect(expectOk(assetFromPersistence(dto)).height).toBeNull();
	});

	/**
	 * And the read boundary owes the DOMAIN's validator on top of that, for the reason the
	 * waste-factor case above exists: `-10` is a perfectly good number, so the schema types
	 * it and passes it on, and only `Asset.create` can see that it is not a height. Silently
	 * catching it to `null` would be the worse answer — a hand edit lost with nothing said.
	 */
	it('a negative height in the note fails the entity validation after the schema', () => {
		const dto = assetToPersistence(makeAsset(), 1);
		dto['height'] = -10;
		expect(expectErr(assetFromPersistence(dto)).code).toBe('asset.negative-height');
	});
});
