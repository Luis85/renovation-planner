import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { err } from '../../../../src/core/result/Result';
import { ReversibleAssignAssetCommand } from '../../../../src/application/commands/requirement/reversible-assign-asset-command';
import {
	ReversibleSetRequirementCostOverrideCommand,
	ReversibleSetRequirementQuantityOverrideCommand,
} from '../../../../src/application/commands/requirement/reversible-override-commands';
import { SetRequirementQuantityOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementQuantityOverride';
import { SetRequirementCostOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementCostOverride';
import type { PersistenceError } from '../../../../src/core/errors/AppError';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset, makeZone, makeRequirement } from '../../../helpers/entities';
import { requirementFixture, TEN_SQUARE_METERS } from '../../../helpers/slice10';

/**
 * The refusal arms of the undoable adapters: undo before any execute, a first execute
 * whose requirement is gone, a read that fails before the first write, a run that fails
 * on either execute or redo, and the conflicts that make an undo or a redo refuse
 * instead of taking someone else's edit with it.
 */

function injectedPersistenceError(): PersistenceError {
	return { category: 'Persistence', code: 'test.injected-failure', message: 'Injected.' };
}

function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

async function wiredWithLink() {
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
	const assigned = await w.assign.execute({ zoneId: zoneEntity.entity.id, assetId: assetEntity.entity.id });
	if (!assigned.ok) throw new Error(`assign failed: ${JSON.stringify(assigned.error)}`);
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
		requirementId: assigned.value.requirement.id,
	};
}

/** A SECOND zone in the same project — one whose asset pair nothing links yet. */
async function freshZone(w: Awaited<ReturnType<typeof wiredWithLink>>) {
	return expectOk(
		await w.zones.save(
			makeZone({ projectId: w.project.entity.id, planId: w.plan.entity.id }),
			'absent',
		),
	);
}

describe('ReversibleAssignAssetCommand refusals', () => {
	it('propagates a failed assign on the first execute', async () => {
		const w = await wiredWithLink();
		const adapter = new ReversibleAssignAssetCommand(
			w.assign,
			{ requirements: w.requirements, zones: w.zones, assets: w.assets, locks: w.locks, events: w.events },
			{ zoneId: w.zoneId, assetId: 'asset-none' as never },
		);
		const error = expectErr(await adapter.execute());
		expect(error.code).toBe('requirement.asset-not-found');
	});

	it('an undo after another tab edited the link refuses instead of deleting that edit', async () => {
		const w = await wiredWithLink();
		const otherZone = await freshZone(w);
		const adapter = new ReversibleAssignAssetCommand(
			w.assign,
			{ requirements: w.requirements, zones: w.zones, assets: w.assets, locks: w.locks, events: w.events },
			{ zoneId: otherZone.entity.id, assetId: w.assetId },
		);
		const executed = await adapter.execute();
		if (!executed.ok) throw new Error(`unexpected execute failure: ${JSON.stringify(executed.error)}`);
		expect(executed.value.requirementId).toBeTruthy();

		// Another writer moves the requirement between this history's execute and undo.
		const cost = new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks);
		expectOk(
			await cost.execute({ requirementId: executed.value.requirementId, cost: null }),
		);

		const error = expectErr(await adapter.undo());
		expect(error.category).toBe('Validation');
	});

	it('a redo refuses when its ZONE has been deleted since the undo', async () => {
		const w = await wiredWithLink();
		const otherZone = await freshZone(w);
		const adapter = new ReversibleAssignAssetCommand(
			w.assign,
			{ requirements: w.requirements, zones: w.zones, assets: w.assets, locks: w.locks, events: w.events },
			{ zoneId: otherZone.entity.id, assetId: w.assetId },
		);
		expectOk(await adapter.execute());
		expectOk(await adapter.undo());

		expectOk(await w.zones.delete(otherZone.entity.id, otherZone.version));

		const error = expectErr(await adapter.execute());
		expect(error.code).toBe('requirement.zone-not-found');
	});

	it('a redo refuses when the id it restores now belongs to someone else', async () => {
		const w = await wiredWithLink();
		const otherZone = await freshZone(w);
		const adapter = new ReversibleAssignAssetCommand(
			w.assign,
			{ requirements: w.requirements, zones: w.zones, assets: w.assets, locks: w.locks, events: w.events },
			{ zoneId: otherZone.entity.id, assetId: w.assetId },
		);
		const executed = await adapter.execute();
		if (!executed.ok) throw new Error('unexpected execute failure');
		const createdId = executed.value.requirementId;
		expectOk(await adapter.undo());

		// A foreign write recreates a requirement under the SAME id — the restore's
		// `'absent'` expectation must refuse it.
		const squatter = makeRequirement({
			id: createdId,
			projectId: w.project.entity.id,
			assetId: w.assetId,
			origin: { kind: 'zone', zoneId: otherZone.entity.id },
		});
		expectOk(await w.requirements.save(squatter, 'absent'));

		const error = expectErr(await adapter.execute());
		expect(error.category).toBe('Validation');
	});
});

describe('Reversible override adapters', () => {
	it('undo before any execute answers undo.before-execute (quantity)', async () => {
		const w = await requirementFixture();
		const adapter = new ReversibleSetRequirementQuantityOverrideCommand(
			new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks),
			w.requirements,
		);
		const error = expectErr(await adapter.undo());
		expect(error.code).toBe('undo.before-execute');
	});

	it('execute with an unknown requirement answers requirement.not-found without running', async () => {
		const w = await requirementFixture();
		const adapter = new ReversibleSetRequirementCostOverrideCommand(
			new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks),
			w.requirements,
		);
		const error = expectErr(
			await adapter.execute({ requirementId: 'requirement-none' as never, cost: null }),
		);
		expect(error.code).toBe('requirement.not-found');
	});

	it('a failed pre-execute read is propagated untouched', async () => {
		const w = await wiredWithLink();
		const requirements = overridePort(w.requirements, {
			getById: () => Promise.resolve(err(injectedPersistenceError())),
		});
		const adapter = new ReversibleSetRequirementQuantityOverrideCommand(
			new SetRequirementQuantityOverrideCommand(requirements, w.events, w.locks),
			requirements,
		);
		const error = expectErr(
			await adapter.execute({ requirementId: 'requirement-none' as never, quantity: 2 }),
		);
		expect(error.code).toBe('test.injected-failure');
	});

	it('a run that fails on the FIRST execute leaves no snapshot behind', async () => {
		const w = await wiredWithLink();
		const adapter = new ReversibleSetRequirementQuantityOverrideCommand(
			new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks),
			w.requirements,
		);
		const error = expectErr(await adapter.execute({ requirementId: w.requirementId, quantity: -3 }));
		expect((error as { code: string }).code).toBe('requirement.negative-quantity');
		const undoError = expectErr(await adapter.undo());
		expect(undoError.code).toBe('undo.before-execute');
	});

	it('a run that fails on a REDO propagates while keeping the snapshot', async () => {
		const w = await wiredWithLink();
		const setCommand = new SetRequirementQuantityOverrideCommand(w.requirements, w.events, w.locks);
		const adapter = new ReversibleSetRequirementQuantityOverrideCommand(setCommand, w.requirements);

		expectOk(await adapter.execute({ requirementId: w.requirementId, quantity: 5 }));
		expectOk(await adapter.undo());

		const redoError = expectErr(
			await adapter.execute({ requirementId: w.requirementId, quantity: -3 }),
		);
		expect((redoError as { code: string }).code).toBe('requirement.negative-quantity');

		// The refused redo stays on the stack: the recorded input still undoes cleanly.
		expectOk(await adapter.undo());
	});
});
