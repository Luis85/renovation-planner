import { describe, expect, it, vi } from 'vitest';
import { err } from '../../../../src/core/result/Result';
import { persistenceError } from '../../../../src/application/errors';
import { DeleteAssetCommand } from '../../../../src/application/commands/asset/DeleteAsset';
import { SetAssetPriceOverrideCommand } from '../../../../src/application/commands/asset-price/SetAssetPriceOverride';
import { ClearAssetPriceOverrideCommand } from '../../../../src/application/commands/asset-price/ClearAssetPriceOverride';
import { of as moneyOf } from '../../../../src/core/money/Money';
import { expectOk } from '../../../helpers/domain';
import { makeAsset, makeProject } from '../../../helpers/entities';
import { requirementFixture } from '../../../helpers/slice10';

/**
 * `DeleteAssetCommand` gathered its referents from `requirements.listByAsset` alone, so an
 * asset carrying a price override and NO Requirement deleted with nothing observed, leaving
 * the override's `asset` id dangling — Task 7a's whole reason for existing. Every case here
 * asserts what MOVED (the override rows), never merely that the delete succeeded, because the
 * delete succeeds either way.
 */

function deferred<T = void>() {
	let resolveFn!: (value: T) => void;
	const promise = new Promise<T>((resolve) => {
		resolveFn = resolve;
	});
	return { promise, resolve: resolveFn };
}

async function wired() {
	const w = await requirementFixture();
	const asset = expectOk(await w.assets.save(makeAsset(), 'absent'));
	const assetId = asset.entity.id;
	const setOverride = new SetAssetPriceOverrideCommand({
		overrides: w.overrides,
		projects: w.projects,
		assets: w.assets,
		events: w.events,
		locks: w.locks,
	});
	const notify = {
		markerClearFailed: vi.fn<(entityId: string) => void>(),
		priceCleanupFailed: vi.fn<(assetId: string) => void>(),
	};
	const logger = {
		debug: vi.fn<(event: string, context?: Record<string, unknown>) => void>(),
		info: vi.fn<(event: string, context?: Record<string, unknown>) => void>(),
		warn: vi.fn<(event: string, context?: Record<string, unknown>) => void>(),
		error: vi.fn<(event: string, context?: Record<string, unknown> & { cause?: unknown }) => void>(),
	};
	const deleteAsset = new DeleteAssetCommand({
		assets: w.assets,
		requirements: w.requirements,
		recalculate: w.recalculate,
		events: w.events,
		locks: w.locks,
		logger,
		overrides: w.overrides,
		notify,
	});
	return { ...w, asset, assetId, setOverride, deleteAsset, notify, logger };
}

describe('DeleteAssetCommand and price overrides', () => {
	/**
	 * THE case: an asset with an override and no Requirement. Today this deletes cleanly with
	 * no referents observed, which is why the defect is invisible.
	 */
	it('deletes the price overrides of an asset that has no requirements', async () => {
		const w = await wired();
		expectOk(await w.setOverride.execute({
			projectId: w.project.entity.id,
			assetId: w.assetId,
			unitCost: moneyOf('19.50', 'EUR'),
			expected: 'absent',
		}));
		expectOk(await w.deleteAsset.execute({ assetId: w.assetId }));
		// Assert what MOVED, not that the delete succeeded — it succeeds either way.
		expect(expectOk(await w.overrides.listByAsset(w.assetId))).toHaveLength(0);
	});

	it('deletes overrides across every project that had one', async () => {
		const w = await wired();
		// Projects A and B both price the shared asset.
		const projectB = expectOk(await w.projects.save(makeProject(), 'absent'));
		expectOk(await w.setOverride.execute({
			projectId: w.project.entity.id,
			assetId: w.assetId,
			unitCost: moneyOf('19.50', 'EUR'),
			expected: 'absent',
		}));
		expectOk(await w.setOverride.execute({
			projectId: projectB.entity.id,
			assetId: w.assetId,
			unitCost: moneyOf('21.00', 'EUR'),
			expected: 'absent',
		}));
		expectOk(await w.deleteAsset.execute({ assetId: w.assetId, resolution: 'remove-references', resolvedReferents: [] }));
		expect(expectOk(await w.overrides.listByAsset(w.assetId))).toHaveLength(0);
	});

	it('leaves the overrides of a different asset alone', async () => {
		const w = await wired();
		const otherAsset = expectOk(await w.assets.save(makeAsset({ name: 'Cheaper tile' }), 'absent'));
		expectOk(await w.setOverride.execute({
			projectId: w.project.entity.id,
			assetId: w.assetId,
			unitCost: moneyOf('19.50', 'EUR'),
			expected: 'absent',
		}));
		expectOk(await w.setOverride.execute({
			projectId: w.project.entity.id,
			assetId: otherAsset.entity.id,
			unitCost: moneyOf('30.00', 'EUR'),
			expected: 'absent',
		}));
		expectOk(await w.deleteAsset.execute({ assetId: w.assetId }));
		expect(expectOk(await w.overrides.listByAsset(otherAsset.entity.id))).toHaveLength(1);
	});

	/**
	 * The failure degrades to today's behaviour rather than to data loss, and says so. The
	 * delete still reports ok, because the asset really is gone and reporting otherwise would
	 * make a user retry a deletion that already happened.
	 */
	it('reports the delete as successful, and tells BOTH channels, when an override delete fails', async () => {
		const w = await wired();
		expectOk(await w.setOverride.execute({
			projectId: w.project.entity.id,
			assetId: w.assetId,
			unitCost: moneyOf('19.50', 'EUR'),
			expected: 'absent',
		}));
		vi.spyOn(w.overrides, 'delete').mockResolvedValue(err(persistenceError('asset-price.delete-failed', 'no')));
		const result = await w.deleteAsset.execute({ assetId: w.assetId });
		expect(result.ok).toBe(true);
		expect(w.logger.error).toHaveBeenCalledWith(
			'asset-price.orphaned-by-asset-delete',
			expect.objectContaining({ assetId: w.assetId }),
		);
		// The user-facing half. Asserting only the log passes against a build where the stray
		// note is a developer's problem and nobody else's.
		expect(w.notify.priceCleanupFailed).toHaveBeenCalledWith(w.assetId);
	});

	/**
	 * The other half of `deleteOverridesLocked`'s two failure arms: the LISTING itself can
	 * fail, not only a later `delete` — a separate branch that reports through the same two
	 * channels and returns early, never reaching the per-override loop at all.
	 */
	it('reports the delete as successful, and tells BOTH channels, when listing overrides fails', async () => {
		const w = await wired();
		expectOk(await w.setOverride.execute({
			projectId: w.project.entity.id,
			assetId: w.assetId,
			unitCost: moneyOf('19.50', 'EUR'),
			expected: 'absent',
		}));
		vi.spyOn(w.overrides, 'listByAsset').mockResolvedValue(err(persistenceError('asset-price.list-failed', 'no')));
		const result = await w.deleteAsset.execute({ assetId: w.assetId });
		expect(result.ok).toBe(true);
		expect(w.logger.error).toHaveBeenCalledWith(
			'asset-price.orphaned-by-asset-delete',
			expect.objectContaining({ assetId: w.assetId }),
		);
		expect(w.notify.priceCleanupFailed).toHaveBeenCalledWith(w.assetId);
	});

	/** The publication the cleanup must not displace — see `DeleteAsset.ts`'s tail. */
	it('still publishes AssetDeleted after cleaning the overrides up', async () => {
		const w = await wired();
		expectOk(await w.setOverride.execute({
			projectId: w.project.entity.id,
			assetId: w.assetId,
			unitCost: moneyOf('19.50', 'EUR'),
			expected: 'absent',
		}));
		expectOk(await w.deleteAsset.execute({ assetId: w.assetId }));
		expect(w.events.published.map((e) => e.type)).toContain('AssetDeleted');
	});

	/** Nothing to do, nothing logged — a delete of an unpriced asset stays silent. */
	it('logs nothing when the asset had no overrides', async () => {
		const w = await wired();
		expectOk(await w.deleteAsset.execute({ assetId: w.assetId }));
		expect(w.logger.error).not.toHaveBeenCalled();
	});

	/**
	 * A clear landing between the sequence's release and this cleanup. Without the lock both
	 * paths list the same version and race their conditional deletes: one refuses, and when
	 * that one is the cleanup the user is warned about an orphan the clear had already removed.
	 * Assert BOTH halves — the note is gone AND `notify.priceCleanupFailed` was never called —
	 * because "the note is gone" is equally true of the racing build.
	 *
	 * The ordering is written as a lock ledger — see `DeleteAsset.ts`'s own header for the
	 * account of what each step holds, and why the first two drafts of this case could not
	 * reach the race at all (both sequential) and the third deadlocked.
	 *
	 * 1. Let the delete run `runDeleteResolution` and RELEASE its session. Held: nothing.
	 * 2. Pause the delete BEFORE `deleteOverridesOf` acquires. Held: nothing — achieved by
	 *    wrapping `locks.beginSession` so its SECOND call (the sequence's own is the first)
	 *    signals and then waits before delegating to the real session's `acquire`.
	 * 3. Start the clear (do NOT await it) and pause it after its `listByProject`, before its
	 *    first `delete` — achieved by wrapping `overrides.listByProject` to read for real and
	 *    then wait before returning.
	 * 4. Release the cleanup, still without awaiting.
	 * 5. Release the clear.
	 * 6. Await both.
	 */
	it('does not warn about an orphan a concurrent clear already removed', async () => {
		const w = await wired();
		const set = expectOk(await w.setOverride.execute({
			projectId: w.project.entity.id,
			assetId: w.assetId,
			unitCost: moneyOf('19.50', 'EUR'),
			expected: 'absent',
		}));

		const clearOverride = new ClearAssetPriceOverrideCommand({
			overrides: w.overrides,
			events: w.events,
			locks: w.locks,
		});

		// Pause point 1: the cleanup's OWN session (the sequence's own beginSession is the
		// first call), paused right before its `acquire` — held: nothing at that point.
		const reachedPause = deferred<void>();
		const releaseCleanup = deferred<void>();
		let beginSessionCalls = 0;
		const realBeginSession = w.locks.beginSession.bind(w.locks);
		w.locks.beginSession = () => {
			beginSessionCalls += 1;
			const session = realBeginSession();
			if (beginSessionCalls === 2) {
				const realAcquire = session.acquire.bind(session);
				session.acquire = async (level1: readonly string[], level2: readonly string[]) => {
					reachedPause.resolve();
					await releaseCleanup.promise;
					return realAcquire(level1, level2);
				};
			}
			return session;
		};

		// Pause point 2: the clear's own read, paused after it has read the real answer and
		// before it returns — "it has read v1" — so its own `delete` has not run yet.
		const clearHasRead = deferred<void>();
		const releaseClear = deferred<void>();
		const realListByProject = w.overrides.listByProject.bind(w.overrides);
		w.overrides.listByProject = async (projectId) => {
			const result = await realListByProject(projectId);
			clearHasRead.resolve();
			await releaseClear.promise;
			return result;
		};

		// Steps 1-2: run the delete, which pauses right before its cleanup acquires.
		const deleting = w.deleteAsset.execute({ assetId: w.assetId });
		await reachedPause.promise;

		// Step 3: start the clear without awaiting it, and let it read before the cleanup
		// resumes — it now holds [projectId, assetId] and has read the pre-clear version.
		const clearing = clearOverride.execute({
			projectId: w.project.entity.id,
			assetId: w.assetId,
			expected: { id: set.override.id, version: set.version },
		});
		await clearHasRead.promise;

		// Step 4: release the cleanup — it now contends for the asset lock the clear holds.
		releaseCleanup.resolve();

		// Step 5: release the clear — its conditional delete lands and it releases the lock.
		releaseClear.resolve();

		// Step 6: await both.
		const [deleted, cleared] = await Promise.all([deleting, clearing]);

		expect(deleted.ok).toBe(true);
		expect(cleared.ok).toBe(true);
		expect(expectOk(await w.overrides.listByAsset(w.assetId))).toHaveLength(0);
		expect(w.notify.priceCleanupFailed).not.toHaveBeenCalled();
	});
});
