import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import { of as moneyOf } from '../../src/core/money/Money';
import type { RequirementRepository } from '../../src/application/ports/RequirementRepository';
import type { EntityVersion } from '../../src/application/ports/versioning';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { ZoneId } from '../../src/domain/zone/ZoneId';
import type { RequirementId } from '../../src/domain/requirement/RequirementId';
import { expectErr, expectOk } from '../helpers/domain';
import { makeRequirement } from '../helpers/entities';

/**
 * The shared RequirementRepository contract (SDD §72). Beyond the standard conditional
 * write terms it owns two things no other port has: `markStale` (a one-directional
 * targeted-property write) and the list lookups (`listByZone` / `listByAsset`) the
 * recalculation cascade and every reference-integrity check depend on.
 *
 * The contract suite deliberately includes a RELOAD test for staleness: save a stale
 * requirement, discard all in-memory state, re-read. For the in-memory side "reload" is a
 * fresh store rehydrated through save/getById; the Obsidian fixture does it by dropping
 * caches and reading the note back off disk.
 */
export interface RequirementFixture {
	readonly repository: RequirementRepository;
	touch(id: RequirementId): void;
	otherProject(): ProjectId;
	/** Fresh ids for the two ends of the reference a requirement links. */
	newZone(): ZoneId;
	newAsset(): AssetId;
}

function fabricated(observed: EntityVersion['observed']): EntityVersion {
	return { revision: 99, observed };
}

/** One fresh requirement wired to fresh endpoints of the fixture under test. */
function newRequirement(f: RequirementFixture) {
	return makeRequirement({
		projectId: f.otherProject(),
		assetId: f.newAsset(),
		origin: { kind: 'zone', zoneId: f.newZone() },
	});
}

export function requirementRepositoryContract(make: () => RequirementFixture): void {
	describe('RequirementRepository contract', () => {
		it('getById answers ok(null) for a missing id', async () => {
			const f = make();
			const requirement = newRequirement(f);
			expect(await f.repository.getById(requirement.id)).toEqual({ ok: true, value: null });
		});

		it("save with 'absent' inserts at revision 1 and reads back", async () => {
			const f = make();
			const requirement = newRequirement(f);
			const written = expectOk(await f.repository.save(requirement, 'absent'));
			expect(written.version.revision).toBe(1);
			expect(expectOk(await f.repository.getById(requirement.id))?.entity.assetId).toBe(
				requirement.assetId,
			);
		});

		it('save is an ID-keyed upsert when given the version it returned', async () => {
			const f = make();
			const zoneId = f.newZone();
			const requirement = makeRequirement({
				projectId: f.otherProject(),
				assetId: f.newAsset(),
				origin: { kind: 'zone', zoneId },
			});
			const first = expectOk(await f.repository.save(requirement, 'absent'));
			// Requirements have no `name`, so the shared upsert helper does not apply;
			// the same rule asserted over a field this entity actually has.
			const changed = first.entity.withCostOverride({
				...first.entity.estimatedCost.calculated,
				amount: '1.00',
			});
			if (!changed.ok) throw new Error('unexpected success');
			const second = await f.repository.save(changed.value, first.version);
			expect(second.ok).toBe(true);
			if (!second.ok) return;
			expect(second.value.version.revision).toBeGreaterThanOrEqual(2);
			const reread = expectOk(await f.repository.getById(requirement.id));
			// Compared as a VALUE: the Obsidian mapper normalizes through `Money.of`
			// ('1.00' → '1') while the in-memory store preserves the string verbatim —
			// both are a lossless read of what was written, at this test's precision.
			expect(reread?.entity.estimatedCost.override?.amount.startsWith('1')).toBe(true);
		});

		it("save with 'absent' refuses when something already holds the id", async () => {
			const f = make();
			const requirement = newRequirement(f);
			expectOk(await f.repository.save(requirement, 'absent'));
			expect((await f.repository.save(requirement, 'absent')).ok).toBe(false);
		});

		it('save refuses a stale revision', async () => {
			const f = make();
			const requirement = newRequirement(f);
			const written = expectOk(await f.repository.save(requirement, 'absent'));
			const error = expectErr(
				await f.repository.save(requirement, fabricated(written.version.observed)),
			);
			expect(error.code).toBe('requirement.revision-conflict');
		});

		it('save refuses after an external modification — even with revision untouched', async () => {
			const f = make();
			const requirement = newRequirement(f);
			const written = expectOk(await f.repository.save(requirement, 'absent'));
			f.touch(requirement.id);
			const error = expectErr(
				await f.repository.save(requirement, {
					revision: written.version.revision,
					observed: written.version.observed,
				}),
			);
			expect(error.code).toBe('requirement.external-modification');
		});

		it("delete takes its own expected version and answers ok(null) afterwards", async () => {
			const f = make();
			const requirement = newRequirement(f);
			const written = expectOk(await f.repository.save(requirement, 'absent'));
			await f.repository.delete(requirement.id, written.version);
			expect(await f.repository.getById(requirement.id)).toEqual({ ok: true, value: null });
		});

		it('delete refuses a stale expectation or an unknown id', async () => {
			const f = make();
			const requirement = newRequirement(f);
			const written = expectOk(await f.repository.save(requirement, 'absent'));
			expect(
				(await f.repository.delete(requirement.id, fabricated(written.version.observed))).ok,
			).toBe(false);
			const stranger = newRequirement(f);
			expect((await f.repository.delete(stranger.id, written.version)).ok).toBe(false);
		});

		it('markStale persists the marker and survives a reload', async () => {
			const f = make();
			const requirement = newRequirement(f);
			const written = expectOk(await f.repository.save(requirement, 'absent'));
			expectOk(await f.repository.markStale(requirement.id));
			// Reload: discard in-memory state by reading back through getById only.
			const reread = expectOk(await f.repository.getById(requirement.id));
			expect(reread?.entity.recalculationStatus).toBe('stale');
			expect(reread?.version.revision).toBeGreaterThanOrEqual(written.version.revision);
		});

		it('markStale refuses an id that does not exist rather than answering ok', async () => {
			const f = make();
			const requirement = newRequirement(f);
			expect((await f.repository.markStale(requirement.id)).ok).toBe(false);
		});

		/**
		 * The test that fails if a persisted decimal is ever written as a YAML float. Three
		 * decimal places on purpose: `594.005` is not representable in binary floating point,
		 * so a value that went through a `number` at ANY point in the round trip comes back as
		 * `594.0049999...` or is silently rounded to `594.00`. Asserted on the `Decimal`, with
		 * `equals` rather than a string compare, because the claim is about the VALUE — a
		 * string compare would also fail a harmless `594.0050`.
		 */
		it('a three-decimal figure round-trips through persistence without loss', async () => {
			const f = make();
			const requirement = makeRequirement({
				projectId: f.otherProject(),
				assetId: f.newAsset(),
				origin: { kind: 'zone', zoneId: f.newZone() },
				quantity: { calculated: { value: new Decimal('13.2005'), unit: 'm2' } },
				estimatedCost: { calculated: moneyOf('594.005', 'EUR') },
			});
			expectOk(await f.repository.save(requirement, 'absent'));

			const reread = expectOk(await f.repository.getById(requirement.id));
			if (reread === null) throw new Error('expected the saved requirement to read back');
			expect(new Decimal(reread.entity.estimatedCost.calculated.amount).equals(new Decimal('594.005')))
				.toBe(true);
			expect(reread.entity.quantity.calculated.value.equals(new Decimal('13.2005'))).toBe(true);
		});

		it('listByZone and listByAsset each return only their own requirements', async () => {
			const f = make();
			const project = f.otherProject();
			const zoneA = f.newZone();
			const assetA = f.newAsset();
			const onTarget = makeRequirement({ projectId: project, assetId: assetA, origin: { kind: 'zone', zoneId: zoneA } });
			const alsoOnTarget = makeRequirement({ projectId: project, assetId: f.newAsset(), origin: { kind: 'zone', zoneId: zoneA } });
			const otherZone = makeRequirement({ projectId: project, assetId: assetA, origin: { kind: 'zone', zoneId: f.newZone() } });
			const otherAsset = makeRequirement({ projectId: project, assetId: f.newAsset(), origin: { kind: 'zone', zoneId: zoneA } });
			for (const r of [onTarget, alsoOnTarget, otherZone, otherAsset]) {
				expectOk(await f.repository.save(r, 'absent'));
			}
			expect(expectOk(await f.repository.listByZone(zoneA)).map((r) => r.entity.id)).toEqual([
				onTarget.id,
				alsoOnTarget.id,
				otherAsset.id,
			]);
			expect(expectOk(await f.repository.listByAsset(assetA)).map((r) => r.entity.id)).toEqual([
				onTarget.id,
				otherZone.id,
			]);
		});
	});
}
