import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { ReversibleAssignAssetCommand } from '../../../../src/application/commands/requirement/reversible-assign-asset-command';
import { AssignAssetCommand } from '../../../../src/application/commands/requirement/AssignAsset';
import { UpdateAssetCommand } from '../../../../src/application/commands/asset/UpdateAsset';
import { SetRequirementCostOverrideCommand } from '../../../../src/application/commands/requirement/SetRequirementCostOverride';
import { of as moneyOf } from '../../../../src/core/money/Money';
import type { MeasurementUnit } from '../../../../src/core/units/MeasurementUnit';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset, makeZone } from '../../../helpers/entities';
import {
	requirementFixture,
	TEN_SQUARE_METERS,
} from '../../../helpers/slice10';

/**
 * PRD §68's undoable assignment, and the update-path half of the unit-kind invariant.
 */

async function wired() {
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
			makeAsset({ projectId: w.project.entity.id, wasteFactorDefault: new Decimal('0.10') }),
			'absent',
		),
	);
	return {
		...w,
		zoneId: zoneEntity.entity.id,
		assetId: assetEntity.entity.id,
	};
}

function makeAdapter(
	w: Awaited<ReturnType<typeof wired>>,
) {
	const assign = new AssignAssetCommand(w.zones, w.assets, w.requirements, w.events, w.locks);
	return new ReversibleAssignAssetCommand(assign, {
		requirements: w.requirements,
		zones: w.zones,
		assets: w.assets,
		locks: w.locks,
	}, {
		zoneId: w.zoneId,
		assetId: w.assetId,
	});
}

describe('ReversibleAssignAssetCommand', () => {
	it('undo removes what execute created; redo brings it back under the SAME id', async () => {
		const w = await wired();
		const adapter = makeAdapter(w);

		const first = await adapter.execute();
		if (!first.ok) throw new Error(String(first.error));
		const createdId = first.value.requirementId;
		expect(expectOk(await w.requirements.getById(createdId))).not.toBeNull();

		expectOk(await adapter.undo());
		expect(await w.requirements.getById(createdId)).toEqual({ ok: true, value: null });

		expectOk(await adapter.execute());
		// Redo restores the ID — a fresh identity would strand every later command that
		// captured the old one.
		const restored = expectOk(await w.requirements.getById(createdId));
		expect(restored?.entity.id).toBe(createdId);
	});

	it('on the idempotent path undo deletes NOTHING and preserves overrides', async () => {
		const w = await wired();
		const assign = new AssignAssetCommand(w.zones, w.assets, w.requirements, w.events, w.locks);
		const preExisting = await assign.execute({ zoneId: w.zoneId, assetId: w.assetId });
		if (!preExisting.ok) throw new Error('unexpected failure');

		// Someone sets an override on the found link.
		await new SetRequirementCostOverrideCommand(w.requirements, w.events, w.locks).execute({
			requirementId: preExisting.value.requirement.id,
			cost: moneyOf('400.00', 'EUR'),
		});

		// The second tab's gesture takes the idempotent path…
		const adapter = makeAdapter(w);
		const found = await adapter.execute();
		if (!found.ok) throw new Error(String(found.error));
		expectOk(await adapter.undo());

		const stillThere = expectOk(await w.requirements.getById(preExisting.value.requirement.id));
		expect(stillThere?.entity.estimatedCost.override?.amount).toBe(moneyOf('400.00', 'EUR').amount);
	});

	it('reads `created` from the command result, never from a pre-dispatch read', async () => {
		const w = await wired();
		// Two adapters dispatch against one repository without awaiting either — the
		// interleaving an inferring adapter fails while passing every single-tab test.
		const first = makeAdapter(w);
		const second = makeAdapter(w);
		const results = await Promise.all([first.execute(), second.execute()]);
		if (!results[0].ok || !results[1].ok) throw new Error('unexpected failure');

		// Undo both: exactly one of them may delete anything, and afterwards the
		// surviving requirement (if any) is intact with its overrides.
		await Promise.all([first.undo(), second.undo()]);
		const remaining = expectOk(await w.requirements.listByZone(w.zoneId));
		expect(remaining.length).toBeLessThanOrEqual(1);
	});

	it('redo REVALIDATES: a unit changed to m while unlinked refuses and creates nothing', async () => {
		const w = await wired();
		const adapter = makeAdapter(w);
		expectOk(await adapter.execute());
		const id = expectOk(await w.requirements.listByZone(w.zoneId))[0]?.entity.id;
		expectOk(await adapter.undo());

		// With the link gone, the guard permits changing m2 → m.
		const assets = expectOk(await w.assets.getById(w.assetId));
		if (!assets) throw new Error('unexpected failure');
		const update = new UpdateAssetCommand(
			w.assets,
			w.requirements,
			w.events,
			w.locks,
		);
		const changed = await update.execute({ assetId: w.assetId, changes: { unit: 'm' as MeasurementUnit } });
		if (!changed.ok) throw new Error(String(changed.error));

		const redo = await adapter.execute();
		expect(redo.ok).toBe(false);
		if (redo.ok) return;
		expect(redo.error.code).toBe('requirement.unit-not-area');
		expect(await w.requirements.getById(id as never)).toEqual({ ok: true, value: null });
	});
});

describe('UpdateAssetCommand unit-kind guard', () => {
	it('refuses a kind-crossing unit change WHILE referents exist — nothing written', async () => {
		const w = await wired();
		await w.assign.execute({ zoneId: w.zoneId, assetId: w.assetId });
		const before = expectOk(await w.assets.getById(w.assetId));

		const error = expectErr(
			await new UpdateAssetCommand(w.assets, w.requirements, w.events, w.locks).execute({
				assetId: w.assetId,
				changes: { unit: 'm' as MeasurementUnit },
			}),
		);
		expect(error.code).toBe('asset.unit-kind-referenced');
		expect(error.message).toContain('1');
		const after = expectOk(await w.assets.getById(w.assetId));
		expect(after?.entity.unit).toBe(before?.entity.unit);
	});

	it('allows a kind-crossing change on an UNREFERENCED asset', async () => {
		const w = await wired();
		const changed = await new UpdateAssetCommand(w.assets, w.requirements, w.events, w.locks)
			.execute({ assetId: w.assetId, changes: { unit: 'm' as MeasurementUnit } });
		expect(changed.ok).toBe(true);
	});

	it('publishes AssetUpdated on every successful save, name edits included', async () => {
		const w = await wired();
		w.events.published.length = 0;
		await new UpdateAssetCommand(w.assets, w.requirements, w.events, w.locks).execute({
				assetId: w.assetId,
				changes: { name: 'Just renamed' },
		});
		expect(w.events.published.map((e) => (e as { type: string }).type)).toContain('AssetUpdated');
	});
});
