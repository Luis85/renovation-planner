import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { SetRequirementQuantityOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementCostOverride';
import {
	ReversibleSetRequirementQuantityOverrideCommand,
	ReversibleSetRequirementCostOverrideCommand,
} from '../../../../src/application/commands/requirement/reversible-override-commands';
import { of as moneyOf } from '../../../../src/core/money/Money';
import { makeAsset, makeZone } from '../../../helpers/entities';
import { expectErr, expectOk } from '../../../helpers/domain';
import { requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';

/**
 * §52 applied twice, and the adapters the panel actually dispatches. The third
 * transition of each (value → null) is what separates a correct snapshot from one that
 * reads a captured null as "there was nothing here" — silently, since every other test
 * in the family passes.
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
			makeAsset({
				wasteFactorDefault: new Decimal('0.10'),
			}),
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

describe('override commands', () => {
	it('the quantity override re-runs the cost pipeline on the effective quantity', async () => {
		const w = await withRequirement();
		const command = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
		w.events.clear();
		const result = await command.execute({ requirementId: w.requirementId, quantity: 20 });
		if (!result.ok) throw new Error(String(result.error));

		expect(result.value.quantity.override?.value.toNumber()).toBe(20);
		// 20 × 45.00 = 900 — the CALCULATED side follows the override's effective quantity…
		expect(result.value.estimatedCost.calculated.amount).toBe('900.00');
		// …and CostEstimateChanged fired exactly once.
		const costEvents = w.events.published.filter(
			(e) => (e as { type: string }).type === 'CostEstimateChanged',
		);
		expect(costEvents).toHaveLength(1);
	});

	it('a cost override publishes only when the effective figure actually moved', async () => {
		const w = await withRequirement();
		const command = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);

		w.events.clear();
		await command.execute({ requirementId: w.requirementId, cost: moneyOf('400.00', 'EUR') });
		expect(
			w.events.published.filter((e) => (e as { type: string }).type === 'CostEstimateChanged'),
		).toHaveLength(1);

		// Writing the SAME figure fires nothing.
		w.events.clear();
		await command.execute({ requirementId: w.requirementId, cost: moneyOf('400.00', 'EUR') });
		expect(
			w.events.published.filter((e) => (e as { type: string }).type === 'CostEstimateChanged'),
		).toHaveLength(0);
	});
});

describe('reversible override adapters', () => {
	it.each([
		{ label: 'overriding a calculated figure', input: { quantity: 12 } },
		{ label: 'changing an existing override', input: { quantity: 15 }, seed: { quantity: 12 } },
		{
			label: 'resetting to calculated',
			input: { quantity: null },
			seed: { quantity: 15 },
			expectOverride: 15,
			expectCalculatedCost: '675.00',
		},
	])(
		'the quantity adapter restores the WHOLE entity: $label',
		async ({ input, seed, expectOverride, expectCalculatedCost }) => {
			const w = await withRequirement();
			const plain = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
			if (seed) {
				const seeder = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
				expectOk(await seeder.execute({ requirementId: w.requirementId, ...seed }));
			}
			// ONE adapter per user intent, exactly as CommandHistory.run() holds them: each
			// entry on the undo stack is its own instance capturing ITS pre-edit state.
			const adapter = new ReversibleSetRequirementQuantityOverrideCommand(plain, w.requirements);
			const before = expectOk(await w.requirements.getById(w.requirementId));

			expectOk(await adapter.execute({ requirementId: w.requirementId, ...input }));
			expectOk(await adapter.undo());

			const after = expectOk(await w.requirements.getById(w.requirementId));
			// The left-hand side of THIS transition is what undo lands on.
			const expectedOverride = expectOverride ?? seed?.quantity ?? null;
			expect(after?.entity.quantity.override?.value.toNumber() ?? null).toBe(expectedOverride);
			// Full-entity comparison, not just the field edited: the quantity write also
			// re-runs the Cost Pipeline, so estimatedCost.calculated must come back too.
			expect(after?.entity.estimatedCost.calculated.amount).toBe(
				expectCalculatedCost ?? before?.entity.estimatedCost.calculated.amount,
			);
			expect(after?.entity.wasteFactor.toString()).toBe(before?.entity.wasteFactor.toString());
		},
	);

	it('the cost adapter undoing a reset restores the number the user had typed', async () => {
		const w = await withRequirement();
		const plain = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);
		const setter = new ReversibleSetRequirementCostOverrideCommand(plain, w.requirements);
		expectOk(await setter.execute({ requirementId: w.requirementId, cost: moneyOf('550.00', 'EUR') }));

		// Reset-to-calculated is its own intent, its own adapter instance.
	 const resetter = new ReversibleSetRequirementCostOverrideCommand(plain, w.requirements);
		expectOk(await resetter.execute({ requirementId: w.requirementId, cost: null }));
		const cleared = expectOk(await w.requirements.getById(w.requirementId));
		expect(cleared?.entity.estimatedCost.override ?? null).toBeNull();

		expectOk(await resetter.undo());
		const restored = expectOk(await w.requirements.getById(w.requirementId));
		expect(restored?.entity.estimatedCost.override?.amount).toBe(moneyOf('550.00', 'EUR').amount);
	});

	it('undo/redo rounds do not drift — redo re-applies the recorded value', async () => {
		const w = await withRequirement();
		const plain = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
		const adapter = new ReversibleSetRequirementQuantityOverrideCommand(plain, w.requirements);

		expectOk(await adapter.execute({ requirementId: w.requirementId, quantity: 12 }));
		for (let round = 0; round < 2; round += 1) {
			expectOk(await adapter.undo());
			expectOk(await adapter.execute({ requirementId: w.requirementId, quantity: 12 }));
		}
		// A snapshot-on-every-execute adapter would have captured the POST-undo state on
		// the second execute and drifted here.
		const final = expectOk(await w.requirements.getById(w.requirementId));
		expect(final?.entity.quantity.override?.value.toNumber()).toBe(12);

		expectOk(await adapter.undo());
		const undone = expectOk(await w.requirements.getById(w.requirementId));
		expect(undone?.entity.quantity.override ?? null).toBeNull();
	});

	it('an edit landed by another writer between execute and undo refuses instead of clobbering', async () => {
		const w = await withRequirement();
		const quantity = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
		const adapter = new ReversibleSetRequirementQuantityOverrideCommand(quantity, w.requirements);
		expectOk(await adapter.execute({ requirementId: w.requirementId, quantity: 12 }));

		// Another writer (a concurrent recalculation or a second tab's override) moves it.
		const rival = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);
		await rival.execute({ requirementId: w.requirementId, cost: moneyOf('777.00', 'EUR') });

		const error = expectErr(await adapter.undo());
		expect(error.code).toContain('revision-conflict');
		// …and the rival's edit is still there.
		const current = expectOk(await w.requirements.getById(w.requirementId));
		expect(current?.entity.estimatedCost.override?.amount).toBe(
			moneyOf('777.00', 'EUR').amount,
		);
	});
});
