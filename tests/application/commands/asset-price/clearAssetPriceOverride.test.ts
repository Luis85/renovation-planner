import { describe, expect, it, vi } from 'vitest';
import { ClearAssetPriceOverrideCommand } from '../../../../src/application/commands/asset-price/ClearAssetPriceOverride';
import { InMemoryProjectRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryAssetRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { err } from '../../../../src/core/result/Result';
import { persistenceError } from '../../../../src/application/errors';
import { currencyOf } from '../../../../src/core/money/Money';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import { expectOk, injectedReadFailure, RecordingEventBus } from '../../../helpers/domain';
import { makeAsset, makeProject } from '../../../helpers/entities';
import { makeOverride } from '../../../contracts/asset-price-override-repository.contract';
import type { PriceRowExpectation } from '../../../../src/application/commands/asset-price/priceRowExpectation';

async function wired() {
	const projects = new InMemoryProjectRepository();
	const assets = new InMemoryAssetRepository();
	const overrides = new InMemoryAssetPriceOverrideRepository();
	const bus = new RecordingEventBus();
	const locks = new ReferenceLocks();
	const project = expectOk(
		await projects.save(makeProject({ currency: currencyOf('GBP') }), 'absent'),
	);
	const asset = expectOk(await assets.save(makeAsset(), 'absent'));
	const command = new ClearAssetPriceOverrideCommand({ overrides, events: bus, locks });
	return {
		projectId: project.entity.id,
		assetId: asset.entity.id,
		projects,
		assets,
		overrides,
		bus,
		locks,
		command,
	};
}

/**
 * Saves two notes for a fresh pair and hands back the expectation for the WINNER — the note
 * the row rendered. `overrides.save` is a Promise-returning port, so there is no synchronous
 * version of this to write: all three call sites `await` it.
 *
 * `Exclude<…, 'absent'>` rather than the bare union, DERIVED rather than restated: the winner
 * always exists here, and the ordering case below reads `winner.id` to fail that one note's
 * delete. Typed as the union, that read is a `TS2339` on `'absent'`, and widening it back would
 * cost the case its subject.
 */
async function seedPair(
	overrides: InMemoryAssetPriceOverrideRepository,
	projectId: ProjectId,
	assetId: AssetId,
): Promise<Exclude<PriceRowExpectation, 'absent'>> {
	await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent');
	// The WINNER, and it is the second deliberately: ids are monotonic ULIDs, so the later
	// save mints the higher one and `winningDuplicate` returns it. That is the note the row
	// rendered, so it is the note the expectation names.
	const winner = expectOk(await overrides.save(makeOverride(projectId, assetId, '21.00'), 'absent'));
	return { id: winner.entity.id, version: winner.version };
}

describe('ClearAssetPriceOverrideCommand', () => {
	it('clears an existing override and reports cleared: true', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		const seeded = expectOk(await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent'));
		const result = expectOk(await command.execute({
			projectId,
			assetId,
			expected: { id: seeded.entity.id, version: seeded.version },
		}));
		expect(result.cleared).toBe(true);
		expect(expectOk(await overrides.listByProject(projectId))).toHaveLength(0);
	});

	/** Nothing to invalidate, so a cascade would be pure cost. */
	it('reports cleared: false and publishes nothing for a pair that has none', async () => {
		const { command, bus, projectId, assetId } = await wired();
		const result = expectOk(await command.execute({ projectId, assetId, expected: 'absent' }));
		expect(result.cleared).toBe(false);
		expect(bus.published).toHaveLength(0);
	});

	it('publishes AssetPriceOverrideChanged when it did clear one', async () => {
		const { command, bus, overrides, projectId, assetId } = await wired();
		const seeded = expectOk(await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent'));
		expectOk(await command.execute({
			projectId,
			assetId,
			expected: { id: seeded.entity.id, version: seeded.version },
		}));
		expect(bus.published).toContainEqual(
			expect.objectContaining({ type: 'AssetPriceOverrideChanged', payload: { projectId, assetId } }),
		);
	});

	it('propagates a failed delete without publishing', async () => {
		const { command, overrides, bus, projectId, assetId } = await wired();
		const seeded = expectOk(await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent'));
		vi.spyOn(overrides, 'delete').mockResolvedValue(err(persistenceError('asset-price.write-failed', 'no')));
		const result = await command.execute({
			projectId,
			assetId,
			expected: { id: seeded.entity.id, version: seeded.version },
		});
		expect(result.ok).toBe(false);
		expect(bus.published).toHaveLength(0);
	});

	/**
	 * Two notes for one pair — the state the READ deliberately tolerates. A clear that deletes
	 * only the one `getForPair` returned reports success, runs the cascade, and leaves the
	 * project still holding a price. Seed the duplicate through the repository directly; the
	 * command cannot produce it, which is the point of the lock case above.
	 */
	it('clears every note for the pair, not just the one the read returns', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		expectOk(await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent'));
		// The WINNER, and it is the second deliberately: ids are monotonic ULIDs, so the later
		// save mints the higher one and `winningDuplicate` returns it. That is the note the
		// row rendered, so it is the note the expectation names.
		const winner = expectOk(await overrides.save(makeOverride(projectId, assetId, '21.00'), 'absent'));
		const expected = { id: winner.entity.id, version: winner.version };
		expect(expectOk(await command.execute({ projectId, assetId, expected })).cleared).toBe(true);
		expect(expectOk(await overrides.listByAsset(assetId))).toHaveLength(0);
	});

	/**
	 * A partial clear HAS written. The survivor is now the effective price, so a cascade that
	 * never hears about it leaves every requirement derived from the note that is gone. Asserting
	 * only the refusal passes against a build that stays silent.
	 */
	it('announces what it deleted even when a later delete fails', async () => {
		const { command, overrides, bus, projectId, assetId } = await wired();
		// Seed two notes for the pair, then fail the SECOND delete — which, with the winner
		// deleted first, is a losing duplicate, so the effective price really has moved.
		const winner = await seedPair(overrides, projectId, assetId);
		const real = overrides.delete.bind(overrides);
		let calls = 0;
		vi.spyOn(overrides, 'delete').mockImplementation((id, expected) => {
			calls += 1;
			if (calls === 2) return Promise.resolve(err(persistenceError('asset-price.write-failed', 'no')));
			return real(id, expected);
		});
		const result = await command.execute({ projectId, assetId, expected: winner });
		expect(result.ok).toBe(false);
		expect(bus.published).toContainEqual(
			expect.objectContaining({ type: 'AssetPriceOverrideChanged', payload: { projectId, assetId } }),
		);
	});

	/**
	 * And the other side, so the rule is not "always announce": a delete that fails having
	 * written NOTHING has nothing to announce. Every delete refuses here, so no ordering can
	 * make one land.
	 *
	 * **It does NOT discriminate the ordering, and its own docblock claimed it did** — "watch
	 * it fail against a loop that deletes in `listByAsset` order: a losing duplicate goes
	 * first, succeeds, and the command announces a change nobody made". That losing duplicate
	 * cannot succeed here: `mockResolvedValue` refuses every call, so `removed` stays false in
	 * both worlds and this case reads green against `ordered = forPair`. Measured, and it is
	 * this repository's own first rule — an invariant asserted in a comment gets a test that
	 * fails without it — unapplied in a comment claiming otherwise. The sibling below is the
	 * case that actually holds it, and the two are adjacent so neither reads as a duplicate of
	 * the other: this one is about `removed`, the next one about the ORDER `removed` is
	 * computed in.
	 */
	it('announces nothing when every delete fails', async () => {
		const { command, overrides, bus, projectId, assetId } = await wired();
		const winner = await seedPair(overrides, projectId, assetId);
		vi.spyOn(overrides, 'delete').mockResolvedValue(err(persistenceError('asset-price.write-failed', 'no')));
		const result = await command.execute({ projectId, assetId, expected: winner });
		expect(result.ok).toBe(false);
		expect(bus.published).toHaveLength(0);
	});

	/**
	 * **The winner-first ordering, which nothing held until this case.** `forPair` arrives in
	 * `listByProject` order, which for a duplicated pair puts the LOSER first — `VersionedStore`
	 * preserves insertion order and `seedPair` saves the winner second, so the two orders
	 * genuinely differ, which is what lets one case tell them apart at all.
	 *
	 * Only the WINNER's delete refuses. Winner first, the loop refuses on its first iteration
	 * with `removed` still false: nothing was written, the surviving loser is still what
	 * `getForPair` would answer, so the effective price has not moved and there is nothing to
	 * announce. In `forPair` order the loser is deleted first and succeeds, `removed` goes true,
	 * and the winner's refusal then announces a project-wide recalculation for a price that is
	 * exactly where it was.
	 *
	 * Both assertions are load-bearing and neither is the other's restatement: the published
	 * count is what the ordering decides, and the untouched listing is what says the refusal
	 * really did leave the pair whole — a build that deleted the loser and then announced
	 * nothing would satisfy the first alone.
	 */
	it('deletes the winner first, so a refusal there announces nothing', async () => {
		const { command, overrides, bus, projectId, assetId } = await wired();
		const winner = await seedPair(overrides, projectId, assetId);
		const real = overrides.delete.bind(overrides);
		vi.spyOn(overrides, 'delete').mockImplementation((id, expected) => (
			id === winner.id
				? Promise.resolve(err(persistenceError('asset-price.write-failed', 'no')))
				: real(id, expected)
		));
		const result = await command.execute({ projectId, assetId, expected: winner });
		expect(result.ok).toBe(false);
		expect(bus.published).toHaveLength(0);
		expect(expectOk(await overrides.listByProject(projectId))).toHaveLength(2);
	});

	it('surfaces a failed read of the pair', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		vi.spyOn(overrides, 'listByProject').mockResolvedValue(injectedReadFailure());
		const result = await command.execute({ projectId, assetId, expected: 'absent' });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('test.injected-failure');
	});

	/**
	 * The same lost-update rule the set command keeps: clearing a pair that has moved since
	 * the row rendered discards a price the user never saw. Refused before anything is
	 * deleted, which the untouched listing below is what proves.
	 */
	it('refuses a stale expectation and deletes nothing', async () => {
		const { command, overrides, projectId, assetId } = await wired();
		const seeded = expectOk(await overrides.save(makeOverride(projectId, assetId, '19.50'), 'absent'));
		// The row rendered a version that has since moved.
		const stale = { id: seeded.entity.id, version: { ...seeded.version, revision: seeded.version.revision + 1 } };
		const result = await command.execute({ projectId, assetId, expected: stale });
		expect(result.ok).toBe(false);
		if (result.ok) throw new Error('unreachable');
		expect(result.error.code).toBe('asset-price.revision-conflict');
		expect(expectOk(await overrides.listByProject(projectId))).toHaveLength(1);
	});
});
