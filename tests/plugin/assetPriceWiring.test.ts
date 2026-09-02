// @vitest-environment jsdom
// jsdom: the plugin shell touches the DOM through the module mock, exactly as
// tests/plugin/slice10CascadeWiring.test.ts does.
import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { loadedPlugin } from '../helpers/plugin';
import { createRepositoryStack } from '../helpers/vault';
import { expectOk } from '../helpers/domain';
import { of as moneyOf } from '../../src/core/money/Money';
import { assetPriceOverrideChanged } from '../../src/domain/asset-price/AssetPriceOverride.events';
import { makeAsset, makePlan, makeProject, makeRequirement, makeZone, squareAt } from '../helpers/entities';
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';
import { installObsidianDom } from '../helpers/dom';

// The notice host builds its markup with Obsidian's own `createSpan`/`createEl` globals.
installObsidianDom();

/**
 * `registerOnAssetPriceOverrideChanged` is a file the suite can exercise directly whether or
 * not anything ever registers it at the composition root — this file is what pins that it
 * really is registered, on the SAME bus as every other composed subscription, beside
 * `registerOnAssetUpdated`. Watched red with the `registerOnAssetPriceOverrideChanged(...)`
 * line deleted from `slice10Composition.ts`.
 *
 * Structured for extension on purpose: `seededStack` builds a two-project fixture sharing one
 * asset, and each `it` publishes its own event and reads its own outcome, so a later task can
 * add a case here without restructuring the file.
 */

async function seededStack() {
	const stack = createRepositoryStack();
	const projectA = expectOk(await stack.projects.save(makeProject(), 'absent'));
	const planA = expectOk(await stack.plans.save(makePlan({ projectId: projectA.entity.id }), 'absent'));
	const zoneA = expectOk(
		await stack.zones.save(
			expectOk(makeZone({ projectId: projectA.entity.id, planId: planA.entity.id }).withGeometry({
				points: squareAt().points,
			})),
			'absent',
		),
	);
	const asset = expectOk(
		await stack.assets.save(makeAsset({ wasteFactorDefault: new Decimal('0.10') }), 'absent'),
	);
	// Figures recorded against a price the real pipeline will not reproduce, so the final
	// assertion can tell a recalculation from a no-op.
	const requirementA = expectOk(
		await stack.requirements.save(
			makeRequirement({
				projectId: projectA.entity.id,
				assetId: asset.entity.id,
				origin: { kind: 'zone', zoneId: zoneA.entity.id },
			}),
			'absent',
		),
	);

	// A second project on the same shared asset, with its own requirement — the fixture the
	// narrowing needs to be visible through the composed root, not only through the unit test.
	const projectB = expectOk(await stack.projects.save(makeProject(), 'absent'));
	const planB = expectOk(await stack.plans.save(makePlan({ projectId: projectB.entity.id }), 'absent'));
	const zoneB = expectOk(
		await stack.zones.save(
			expectOk(makeZone({ projectId: projectB.entity.id, planId: planB.entity.id }).withGeometry({
				points: squareAt().points,
			})),
			'absent',
		),
	);
	const requirementB = expectOk(
		await stack.requirements.save(
			makeRequirement({
				projectId: projectB.entity.id,
				assetId: asset.entity.id,
				origin: { kind: 'zone', zoneId: zoneB.entity.id },
			}),
			'absent',
		),
	);

	stack.metadataCache.catchUp();
	return { stack, projectA, projectB, asset, requirementA, requirementB };
}

describe('asset-price wiring', () => {
	it('an AssetPriceOverrideChanged event reaches the composed cascade for its own project', async () => {
		const { stack, projectA, asset, requirementA } = await seededStack();

		// A price edit that has not announced itself yet: after it lands, the link no longer
		// matches what its figures were computed FROM, so the cascade must recalculate for
		// real rather than skip.
		const storedAsset = expectOk(await stack.assets.getById(asset.entity.id));
		if (storedAsset === null) throw new Error('expected the seeded asset');
		const repriced = expectOk(storedAsset.entity.withChanges({ unitCost: moneyOf('50.00', 'EUR') }));
		expectOk(await stack.assets.save(repriced, storedAsset.version));
		stack.metadataCache.catchUp();

		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		await plugin.root.eventBus.publish(
			assetPriceOverrideChanged({ projectId: projectA.entity.id, assetId: asset.entity.id }),
		);

		// The cascade wrote through the PLUGIN's repositories, which hold the plugin's own
		// `EchoWindow`; this stack has a different one, so it can only see the write once
		// Obsidian's parse queue has caught up.
		stack.metadataCache.catchUp();
		const recalculated = expectOk(await stack.requirements.getById(requirementA.entity.id));
		expect(recalculated?.entity.recalculationStatus).toBe('current');
		// 0.0001 m² × 1.10 waste × 50.00 EUR per m², rounded to the minor unit.
		expect(recalculated?.entity.estimatedCost.calculated.amount).toBe('0.01');

		await plugin.onunload();
	});

	it('leaves the other project on the same asset untouched through the composed root', async () => {
		const { stack, projectA, asset, requirementB } = await seededStack();
		const before = expectOk(await stack.requirements.getById(requirementB.entity.id));

		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();

		await plugin.root.eventBus.publish(
			assetPriceOverrideChanged({ projectId: projectA.entity.id, assetId: asset.entity.id }),
		);
		stack.metadataCache.catchUp();

		const after = expectOk(await stack.requirements.getById(requirementB.entity.id));
		// Same revision AND same observed token: no write happened for project B's requirement.
		expect(after?.version).toEqual(before?.version);

		await plugin.onunload();
	});

	/**
	 * Task 8's own coverage gap: nothing in this increment had driven a REAL
	 * `SetAssetPriceOverrideCommand`/`ClearAssetPriceOverrideCommand` end to end through the
	 * composed root before this case — Task 7's two cases above publish the bare event
	 * directly, which proves the SUBSCRIBER is registered but not that the two commands this
	 * task composes and guards actually reach it. Set THEN clear, in one gesture, because the
	 * clear needs a real `overrideId`/`version` to condition on and a set is the only way to
	 * mint one — asserting each half against the SAME requirement and the SAME untouched
	 * sibling is what makes this the end-to-end case rather than two half ones.
	 */
	it('drives a real set and then a real clear through the composed root to a recalculated figure', async () => {
		const { stack, projectA, asset, requirementA, requirementB } = await seededStack();
		const bBefore = expectOk(await stack.requirements.getById(requirementB.entity.id));

		const { plugin, workspace } = await loadedPlugin(DEFAULT_SETTINGS, undefined, true, stack);
		workspace.layoutReady();
		const persistence = plugin.root.persistence as NonNullable<typeof plugin.root.persistence>;

		const set = expectOk(
			await persistence.setAssetPriceOverride.execute({
				projectId: projectA.entity.id,
				assetId: asset.entity.id,
				unitCost: moneyOf('30.00', 'EUR'),
				expected: 'absent',
			}),
		);
		stack.metadataCache.catchUp();

		const afterSet = expectOk(await stack.requirements.getById(requirementA.entity.id));
		expect(afterSet?.entity.recalculationStatus).toBe('current');
		// 0.0001 m² × 1.10 waste × 30.00 EUR per m², rounded to the minor unit — 0.0033 rounds
		// to zero, unlike the 50.00 EUR figure the sibling case above computes.
		expect(afterSet?.entity.calculatedFrom.unitCost.amount).toBe('30');
		expect(afterSet?.entity.estimatedCost.calculated.amount).toBe('0');

		const cleared = expectOk(
			await persistence.clearAssetPriceOverride.execute({
				projectId: projectA.entity.id,
				assetId: asset.entity.id,
				expected: { id: set.override.id, version: set.version },
			}),
		);
		expect(cleared.cleared).toBe(true);
		stack.metadataCache.catchUp();

		const afterClear = expectOk(await stack.requirements.getById(requirementA.entity.id));
		expect(afterClear?.entity.recalculationStatus).toBe('current');
		// Back to the catalogue default — `makeAsset`'s own unitCost, 45.00 EUR — because the
		// project no longer has its own price for this asset.
		expect(afterClear?.entity.calculatedFrom.unitCost.amount).toBe('45');

		// Neither write ever touched project B's requirement — the narrowed cascade, proven
		// again on the door this case is actually about.
		const bAfter = expectOk(await stack.requirements.getById(requirementB.entity.id));
		expect(bAfter?.version).toEqual(bBefore?.version);

		await plugin.onunload();
	});
});
