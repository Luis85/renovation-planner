import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { effectiveValue } from '../../../../src/core/derived/DerivedValue';
import type { Money } from '../../../../src/core/money/Money';
import { of as moneyOf } from '../../../../src/core/money/Money';
import type { DispatchResult } from '../../../../src/application/commands/DispatchOutcome';
import { SetRequirementQuantityOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementCostOverride';
import {
	ReversibleSetRequirementCostOverrideCommand,
	ReversibleSetRequirementQuantityOverrideCommand,
} from '../../../../src/application/commands/requirement/reversible-override-commands';
import { makeAsset, makeZone } from '../../../helpers/entities';
import { expectOk } from '../../../helpers/domain';
import { requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';

/**
 * Task 7: both override adapters restore through the repository port on undo, past the
 * command whose own `execute()` already announces — so undo was silent on the one figure
 * the read model cares about most, the effective cost.
 */

async function withRequirement() {
	const w = await requirementFixture();
	const zoneEntity = expectOk(
		await w.zones.save(
			expectOk(
				makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }).withGeometry({
					points: TEN_SQUARE_METERS,
				}),
			),
			'absent',
		),
	);
	const assetEntity = expectOk(
		await w.assets.save(
			makeAsset({ wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	const assigned = await w.assign.execute({
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
	});
	if (!assigned.ok) throw new Error(String(assigned.error));
	return { ...w, zoneId: zoneEntity.entity.id, requirementId: assigned.value.requirement.id };
}

interface OverrideAdapterRigOptions {
	/**
	 * Set the cost override figure EQUAL to the requirement's own calculated cost — both
	 * `amount` and `currency` — so `publishIfEffectiveCostChanged`'s equality arm, not a
	 * fixture accident, is why the undo announces nothing. Read from the live entity
	 * rather than hard-coded, so a change to `makeAsset`'s or `makeZone`'s defaults cannot
	 * quietly make the two figures unequal again.
	 */
	readonly overrideEqualsCalculated?: boolean;
}

/**
 * `overrideAdapterRig` does not exist anywhere in this tree — this is its only
 * declaration. The wrapped `adapter` binds ONE edit's input the way
 * `inspector-wiring.ts`'s `asDispatchCommand` binds the Inspector's, so `execute()` and
 * `undo()` can be called with no arguments, matching the shape `CommandHistory` dispatches
 * through and the shape the case below drives.
 */
async function overrideAdapterRig(
	kind: 'quantity' | 'cost',
	opts: OverrideAdapterRigOptions = {},
): Promise<{
	readonly adapter: { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };
	readonly events: Awaited<ReturnType<typeof withRequirement>>['events'];
}> {
	const w = await withRequirement();
	const before = expectOk(await w.requirements.getById(w.requirementId));
	if (!before) throw new Error('unexpected: requirement missing right after assignment');
	const calculated: Money = effectiveValue(before.entity.estimatedCost);

	if (kind === 'quantity') {
		const plain = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
		const adapter = new ReversibleSetRequirementQuantityOverrideCommand(plain, w.requirements, w.events);
		const input = { requirementId: w.requirementId, quantity: 20 };
		return {
			adapter: { execute: () => adapter.execute(input), undo: () => adapter.undo() },
			events: w.events,
		};
	}

	const plain = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);
	const adapter = new ReversibleSetRequirementCostOverrideCommand(plain, w.requirements, w.events);
	// Distinct from `calculated` by construction (a different amount) so the ordinary
	// case genuinely moves the effective figure; equal to it, amount AND currency, only
	// when the fixture is asked to make undo a no-op.
	const cost = opts.overrideEqualsCalculated ? calculated : moneyOf('550.00', 'EUR');
	const input = { requirementId: w.requirementId, cost };
	return {
		adapter: { execute: () => adapter.execute(input), undo: () => adapter.undo() },
		events: w.events,
	};
}

describe('reversible override adapters announce the cost undo moves', () => {
	it.each(['quantity', 'cost'] as const)(
		'announces the cost an undone %s override moves back',
		async (kind) => {
			const rig = await overrideAdapterRig(kind);
			await rig.adapter.execute();
			const seen: unknown[] = [];
			rig.events.subscribe('CostEstimateChanged', (event) => { seen.push(event); });

			await rig.adapter.undo();

			expect(seen).toHaveLength(1);
		},
	);

	// The helper's own truthfulness, asserted here because this is the caller that relies on it.
	it('announces nothing when an undo restores the identical figure', async () => {
		const rig = await overrideAdapterRig('cost', { overrideEqualsCalculated: true });
		await rig.adapter.execute();
		const seen: unknown[] = [];
		rig.events.subscribe('CostEstimateChanged', (event) => { seen.push(event); });

		await rig.adapter.undo();

		expect(seen).toEqual([]);
	});
});
