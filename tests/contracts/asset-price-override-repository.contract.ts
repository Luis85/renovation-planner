import { describe, expect, it } from 'vitest';
import type { AssetPriceOverrideRepository } from '../../src/application/ports/AssetPriceOverrideRepository';
import { AssetPriceOverride } from '../../src/domain/asset-price/AssetPriceOverride';
import {
	createAssetPriceOverrideId,
	type AssetPriceOverrideId,
} from '../../src/domain/asset-price/AssetPriceOverrideId';
import { of as moneyOf } from '../../src/core/money/Money';
import { expectOk } from '../helpers/domain';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { AssetId } from '../../src/domain/asset/AssetId';
import type { Loaded } from '../../src/application/ports/versioning';

function makeOverride(projectId: ProjectId, assetId: AssetId, amount = '19.50'): AssetPriceOverride {
	return expectOk(
		AssetPriceOverride.create({
			id: createAssetPriceOverrideId(),
			projectId,
			assetId,
			unitCost: moneyOf(amount, 'GBP'),
		}),
	);
}

/**
 * One fresh override saved for a fresh pair — the setup shared by the read-back, delete and
 * stale-delete cases below. Extracted after `npm run analyze` flagged the four-line preamble
 * as a clone across three `it` blocks (fallow's duplication gate, run over `tests/**` too).
 */
async function savedOverride(
	f: AssetPriceOverrideFixture,
): Promise<{ projectId: ProjectId; assetId: AssetId; saved: Loaded<AssetPriceOverride> }> {
	const projectId = f.newProject();
	const assetId = f.newAsset();
	const saved = expectOk(await f.repository.save(makeOverride(projectId, assetId), 'absent'));
	return { projectId, assetId, saved };
}

/**
 * One contract, both implementations. The in-memory double and the note-backed repository
 * must answer identically or the suite is testing a fake that production does not match —
 * the "a fake must not be kinder than the real thing" rule, expressed as a shared spec.
 */
export interface AssetPriceOverrideFixture {
	readonly repository: AssetPriceOverrideRepository;
	/** Change the note under the repository's feet, for the `observed` arm of a stale save. */
	touch(id: AssetPriceOverrideId): void;
	/**
	 * A project this fixture has PROVISIONED, not a bare `createProjectId()`. The note-backed
	 * repository resolves an insert's folder through `projectFolderOf(index, projectId)` and
	 * refuses an unknown project outright, so a contract minting its own ids fails at the very
	 * first save. `RequirementFixture.otherProject()` is the same member for the same reason.
	 *
	 * **SYNCHRONOUS, deliberately, which is a constraint on the FIXTURE rather than a
	 * convenience here.** Its sibling provisions by PLANTING a note (`plantNote` plus
	 * `projectToPersistence`) rather than by calling the repository, precisely because a
	 * `save` is a promise and this signature has nowhere to await one. An earlier draft of
	 * this plan told the Obsidian fixture to "create a real project note through the project
	 * repository and rebuild the index", which cannot be done here: the contract calls
	 * `overrides.save` on the very next line. Making the member async instead would mean
	 * awaiting it at every call site in all ten cases, and it is the shape the five existing
	 * contracts do not have.
	 */
	newProject(): ProjectId;
	newAsset(): AssetId;
}

export function assetPriceOverrideRepositoryContract(make: () => AssetPriceOverrideFixture): void {
	describe('AssetPriceOverrideRepository contract', () => {
		it('answers null for a pair with no override', async () => {
			const f = make();
			const found = expectOk(await f.repository.getForPair(f.newProject(), f.newAsset()));
			expect(found).toBeNull();
		});

		it('round-trips an override and finds it by its pair', async () => {
			const f = make();
			const { projectId, assetId, saved } = await savedOverride(f);
			expect(saved.version.revision).toBe(1);

			const found = expectOk(await f.repository.getForPair(projectId, assetId));
			expect(found).not.toBeNull();
			// `moneyOf` normalizes through `Decimal#dp()`, which drops an insignificant trailing
			// zero — '19.50' round-trips as '19.5', not '19.50'. Measured against `Money.of`
			// rather than assumed; see the plan-defect note in this task's report.
			expect(found?.entity.unitCost.amount).toBe('19.5');
			expect(found?.entity.unitCost.currency).toBe('GBP');
		});

		/** Three decimals, because `594.005` is not representable in binary floating point
		 *  while `99.99` survives a coercion — the shared rule for catching a YAML float. */
		it('preserves a three-decimal amount exactly', async () => {
			const f = make();
			const projectId = f.newProject();
			const assetId = f.newAsset();
			expectOk(await f.repository.save(makeOverride(projectId, assetId, '594.005'), 'absent'));
			const found = expectOk(await f.repository.getForPair(projectId, assetId));
			expect(found?.entity.unitCost.amount).toBe('594.005');
		});

		it('refuses an insert for an id that is already taken', async () => {
			const f = make();
			const override = makeOverride(f.newProject(), f.newAsset());
			expectOk(await f.repository.save(override, 'absent'));
			const again = await f.repository.save(override, 'absent');
			expect(again.ok).toBe(false);
		});

		it('refuses a save whose expected revision is stale', async () => {
			const f = make();
			const override = makeOverride(f.newProject(), f.newAsset());
			const saved = expectOk(await f.repository.save(override, 'absent'));
			const edited = expectOk(saved.entity.withUnitCost(moneyOf('21.00', 'GBP')));
			expectOk(await f.repository.save(edited, saved.version));
			const stale = await f.repository.save(edited, saved.version);
			expect(stale.ok).toBe(false);
		});

		it('lists by project and by asset, and each excludes the other axis', async () => {
			const f = make();
			const projectA = f.newProject();
			const projectB = f.newProject();
			const assetX = f.newAsset();
			const assetY = f.newAsset();
			expectOk(await f.repository.save(makeOverride(projectA, assetX), 'absent'));
			expectOk(await f.repository.save(makeOverride(projectA, assetY), 'absent'));
			expectOk(await f.repository.save(makeOverride(projectB, assetX), 'absent'));

			const byProject = expectOk(await f.repository.listByProject(projectA));
			expect(byProject).toHaveLength(2);
			expect(byProject.every((o) => o.entity.projectId === projectA)).toBe(true);

			const byAsset = expectOk(await f.repository.listByAsset(assetX));
			expect(byAsset).toHaveLength(2);
			expect(byAsset.every((o) => o.entity.assetId === assetX)).toBe(true);
		});

		/**
		 * The duplicate-pair rule, in the SHARED contract because it is the one place both
		 * implementations can be held to the same answer. Two notes, deterministic winner: the
		 * higher id, which `createEntityId`'s monotonic ULID makes the more recently created.
		 * Without this case the two repositories drifted — the fake answering the oldest match
		 * and the note-backed one the newest — and every duplicate test would have been evidence
		 * about a different program than the one that ships.
		 */
		/**
		 * BOTH save orders, in two fixtures, and an earlier draft of this case drove ONE while
		 * its comment claimed two. `makeOverride` mints monotonic ULIDs, so the second entity
		 * created always has the higher id — and that draft saved it FIRST, which means a
		 * repository answering the OLDEST INSERTED match returns the same entity the rule
		 * demands and passes. The case named the fake-versus-production drift it exists to
		 * catch and could not have caught it in that direction.
		 */
		it.each([
			['newest saved last', false],
			['newest saved first', true],
		])('answers the highest-id override when two notes name one pair (%s)', async (_name, newestFirst) => {
			const f = make();
			const projectId = f.newProject();
			const assetId = f.newAsset();
			const older = makeOverride(projectId, assetId, '19.50');
			const newer = makeOverride(projectId, assetId, '21.00');
			// `newer.id > older.id` by construction; the ORDER of these two saves is the axis.
			const order = newestFirst ? [newer, older] : [older, newer];
			for (const override of order) expectOk(await f.repository.save(override, 'absent'));

			const found = expectOk(await f.repository.getForPair(projectId, assetId));
			expect(found?.entity.id).toBe(newer.id);
		});

		it('deletes an override, after which its pair answers null again', async () => {
			const f = make();
			const { projectId, assetId, saved } = await savedOverride(f);
			expectOk(await f.repository.delete(saved.entity.id, saved.version));
			expect(expectOk(await f.repository.getForPair(projectId, assetId))).toBeNull();
		});

		/**
		 * The OTHER arm of a stale expectation, and the reason the fixture has `touch` and the
		 * in-memory double has `poke`: a note edited outside the plugin keeps its revision, so
		 * only `observed` can tell. Without this case `poke` has no caller at all, which is the
		 * `unused-class-members` finding this repository has already paid for once.
		 */
		it('refuses a save whose expected token is stale even at the same revision', async () => {
			const f = make();
			const override = makeOverride(f.newProject(), f.newAsset());
			const saved = expectOk(await f.repository.save(override, 'absent'));
			f.touch(override.id);
			const stale = await f.repository.save(override, saved.version);
			expect(stale.ok).toBe(false);
		});

		it('refuses a delete whose expected revision is stale', async () => {
			const f = make();
			const { projectId, assetId, saved } = await savedOverride(f);
			const edited = expectOk(saved.entity.withUnitCost(moneyOf('21.00', 'GBP')));
			const second = expectOk(await f.repository.save(edited, saved.version));
			const stale = await f.repository.delete(saved.entity.id, saved.version);
			expect(stale.ok).toBe(false);
			// Read it back through the PAIR rather than by id: the port has no `getById`, and
			// this is the same claim — the note the second save left is still the pair's note.
			const survivor = expectOk(await f.repository.getForPair(projectId, assetId));
			expect(survivor?.entity.id).toBe(second.entity.id);
		});
	});
}
