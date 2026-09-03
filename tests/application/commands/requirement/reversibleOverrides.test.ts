import { describe, expect, it } from 'vitest';
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
import { expectOk } from '../../../helpers/domain';
import { assignedRequirementFixture as withRequirement } from '../../../helpers/slice10';

/**
 * Task 7: both override adapters restore through the repository port on undo, past the
 * command whose own `execute()` already announces — so undo was silent on the one figure
 * the read model cares about most, the effective cost.
 *
 * `withRequirement` is `tests/helpers/slice10.ts`'s `assignedRequirementFixture`, imported
 * under this file's own local name rather than duplicated: `overrides.test.ts` builds the
 * identical shape (a 10 m² zone, a 10%-waste asset, assigned) and both files import the
 * one definition now.
 */

/** The distinct figure each kind writes, so a case can tell WHICH adapter actually ran. */
const QUANTITY_OVERRIDE = 20;
const COST_OVERRIDE = moneyOf('550.00', 'EUR');

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
 * through and the shape the case below drives. `requirements` and `requirementId` travel
 * out alongside `adapter` and `events` so a case can read back which figure actually moved
 * — the rig branches on `kind` internally, and nothing stops that branch from silently
 * building the same adapter twice, so the cases below check the WRITTEN state rather than
 * trusting the branch by construction.
 */
async function overrideAdapterRig(
	kind: 'quantity' | 'cost',
	opts: OverrideAdapterRigOptions = {},
): Promise<{
	readonly adapter: { execute(): Promise<DispatchResult>; undo(): Promise<DispatchResult> };
	readonly events: Awaited<ReturnType<typeof withRequirement>>['events'];
	readonly requirements: Awaited<ReturnType<typeof withRequirement>>['requirements'];
	readonly requirementId: Awaited<ReturnType<typeof withRequirement>>['requirementId'];
}> {
	const w = await withRequirement();

	if (kind === 'quantity') {
		const plain = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
		const adapter = new ReversibleSetRequirementQuantityOverrideCommand(plain, w.requirements, w.events);
		const input = { requirementId: w.requirementId, quantity: QUANTITY_OVERRIDE };
		return {
			adapter: { execute: () => adapter.execute(input), undo: () => adapter.undo() },
			events: w.events,
			requirements: w.requirements,
			requirementId: w.requirementId,
		};
	}

	const plain = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);
	const adapter = new ReversibleSetRequirementCostOverrideCommand(plain, w.requirements, w.events);
	// Distinct from the calculated figure by construction (a different amount) so the
	// ordinary case genuinely moves the effective figure; equal to it, amount AND
	// currency, only when the fixture is asked to make undo a no-op.
	let cost: Money = COST_OVERRIDE;
	if (opts.overrideEqualsCalculated) {
		const before = expectOk(await w.requirements.getById(w.requirementId));
		if (!before) throw new Error('unexpected: requirement missing right after assignment');
		cost = effectiveValue(before.entity.estimatedCost);
	}
	const input = { requirementId: w.requirementId, cost };
	return {
		adapter: { execute: () => adapter.execute(input), undo: () => adapter.undo() },
		events: w.events,
		requirements: w.requirements,
		requirementId: w.requirementId,
	};
}

describe('reversible override adapters announce the cost undo moves', () => {
	it.each(['quantity', 'cost'] as const)(
		'announces the cost an undone %s override moves back',
		async (kind) => {
			const rig = await overrideAdapterRig(kind);
			await rig.adapter.execute();

			// Pins WHICH adapter actually ran. A rig that silently built the cost adapter
			// for both kinds would still move SOME figure and could still satisfy the
			// event-count assertion below — this is what actually tells the two kinds
			// apart, per the finding that the `it.each` bodies alone do not. Both fields
			// are asserted UNCONDITIONALLY (never inside an `if`, which `no-conditional-
			// expect` refuses) with the off-kind expectation `null`, so the wrong adapter
			// having run shows up as the WRONG field moving rather than as neither.
			const written = expectOk(await rig.requirements.getById(rig.requirementId));
			const expectedQuantityOverride = kind === 'quantity' ? QUANTITY_OVERRIDE : null;
			const expectedCostOverride = kind === 'cost' ? COST_OVERRIDE.amount : null;
			expect(written?.entity.quantity.override?.value.toNumber() ?? null).toBe(expectedQuantityOverride);
			expect(written?.entity.estimatedCost.override?.amount ?? null).toBe(expectedCostOverride);

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
