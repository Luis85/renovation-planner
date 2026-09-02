/**
 * "A design write and the DELETE of its asset cannot interleave" — the category, asked of every
 * command that writes an asset's geometry sidecar (PR 43's fourth finding).
 *
 * **What the exposure actually was, measured rather than taken from the report.** An asset's
 * sidecar is a separate file from its note, and `AssetGeometryStore` answers an absent one as a
 * valid empty document at `ABSENT_VERSION` — a real constant, `{ revision: 0, observed:
 * observeSidecar('') }`. So a command that read the note, found the asset, and then had the asset
 * deleted under it presented `expected: ABSENT_VERSION` to a store that now read exactly that,
 * the compare-and-swap AGREED, and the write landed: a `.rpgeo` for an asset that is not there.
 *
 * The version condition protects an asset that HAD geometry — an expected revision 3 against an
 * absent revision 0 refuses, which is why the reported hole is narrower than it first reads — and
 * cannot protect one that did not. That is every first footprint, every first calibration and
 * every first spec sheet, which is the ordinary case for a newly created asset.
 *
 * **Driven through the LOCK rather than through `DeleteAssetCommand`**, and that is deliberate.
 * `runDeleteResolution` has held `ReferenceLocks`'s level-1 lock on its entity across
 * `deleteEntity` since design slice 10, and slice 10's own suite is what proves it does. What was
 * missing is these commands being IN that region, so what these cases stage is a level-1 holder
 * that deletes the asset while holding it — the delete's own behaviour, at the seam that matters,
 * without rebuilding the whole resolution's dependencies around a question about geometry.
 *
 * Each case asserts THREE things and the first is what discriminates: the dispatch has not
 * settled while the lock is held (unlocked, it settled long ago), it refuses `asset.not-found`
 * once the lock is released, and no sidecar exists on disk afterwards. The third alone would pass
 * against a build that wrote none for some unrelated reason.
 */
import { describe, expect, it } from 'vitest';
import { CalibrateAssetCommand } from '../../../../src/application/commands/asset/CalibrateAsset';
import { SetAssetBackgroundCommand } from '../../../../src/application/commands/asset/SetAssetBackground';
import { SetAssetFootprintFromDimensionsCommand } from '../../../../src/application/commands/asset/SetAssetFootprint';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { settle } from '../../../helpers/async';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { createRepositoryStack } from '../../../helpers/vault';

/** The one spec sheet the background case picks; the probe answers for it and nothing else. */
const SHEET = 'Specs/oven.png';

async function seeded() {
	const stack = createRepositoryStack();
	const assetId = createAssetId();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const events = createEventBus();
	const locks = new ReferenceLocks();
	// The NOTE, and deliberately NO sidecar: an asset that already has geometry is protected by
	// the version condition, so seeding one would exercise the arm that never needed a lock.
	const saved = expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	const deps = { sidecar, assets: stack.assets, events, locks };
	return {
		assetId,
		locks,
		version: saved.version,
		assets: stack.assets,
		/** Is there a `.rpgeo` on disk for this asset? The observable the orphan actually is. */
		sidecarExists: (): boolean => stack.vault.entries.has(assetSidecarPathFor(stack.libraryFolder, assetId)),
		typed: new SetAssetFootprintFromDimensionsCommand(deps),
		calibrate: new CalibrateAssetCommand(deps),
		setBackground: new SetAssetBackgroundCommand(deps, { fileExists: (path) => path === SHEET }),
	};
}

type Seeded = Awaited<ReturnType<typeof seeded>>;

/**
 * A peer holding level 1 on this asset, which deletes it while holding —
 * `runDeleteResolution`'s own shape, reduced to the two facts a geometry writer can observe.
 */
async function holdingTheLock(w: Seeded) {
	const session = w.locks.beginSession();
	await session.acquire([w.assetId], []);
	return {
		async releaseHavingDeleted(): Promise<void> {
			expectOk(await w.assets.delete(w.assetId, w.version));
			session.release();
		},
	};
}

describe('a design write against an asset being deleted', () => {
	it('waits for the level-1 lock, then refuses, and writes no footprint sidecar', async () => {
		const w = await seeded();
		const holder = await holdingTheLock(w);

		let settled = false;
		const dispatch = w.typed.execute({ assetId: w.assetId, width: 1200, depth: 800 }).then((result) => {
			settled = true;
			return result;
		});
		await settle();
		// THE discriminating assertion: unlocked, this command has already read the note, found
		// the asset, written the sidecar and resolved by now.
		expect(settled).toBe(false);

		await holder.releaseHavingDeleted();

		expect(expectErr(await dispatch).code).toBe('asset.not-found');
		expect(w.sidecarExists()).toBe(false);
	});

	it('waits for the level-1 lock, then refuses, and writes no calibration sidecar', async () => {
		const w = await seeded();
		const holder = await holdingTheLock(w);

		let settled = false;
		const dispatch = w.calibrate
			.execute({ assetId: w.assetId, pointA: { x: 0, y: 0 }, pointB: { x: 800, y: 0 }, knownDistance: 800 })
			.then((result) => {
				settled = true;
				return result;
			});
		await settle();
		expect(settled).toBe(false);

		await holder.releaseHavingDeleted();

		expect(expectErr(await dispatch).code).toBe('asset.not-found');
		expect(w.sidecarExists()).toBe(false);
	});

	/**
	 * The background command is the one whose gesture spans BOTH resources, which is what makes
	 * an unlocked write worst here: it clears the calibration FIRST, and for an asset with no
	 * sidecar that clear CREATES one, so the orphan is written before the note is even consulted
	 * again.
	 */
	it('waits for the level-1 lock, then refuses, and writes no sidecar for the cleared calibration', async () => {
		const w = await seeded();
		const holder = await holdingTheLock(w);

		let settled = false;
		const dispatch = w.setBackground
			.execute({ assetId: w.assetId, path: SHEET, kind: 'image', page: null })
			.then((result) => {
				settled = true;
				return result;
			});
		await settle();
		expect(settled).toBe(false);

		await holder.releaseHavingDeleted();

		expect(expectErr(await dispatch).code).toBe('asset.not-found');
		expect(w.sidecarExists()).toBe(false);
	});

	/**
	 * The lock is RELEASED whatever the command does, which is the half no case above can see: a
	 * refusal that kept level 1 would deadlock every later writer to that asset, silently and for
	 * the rest of the session. Asserted twice over — the lock reads free, and a later write
	 * against a live asset really completes.
	 */
	it('releases the lock after a refusal, so a later write is not deadlocked', async () => {
		const w = await seeded();
		expectOk(await w.assets.delete(w.assetId, w.version));

		expect(expectErr(await w.typed.execute({ assetId: w.assetId, width: 1200, depth: 800 })).code).toBe(
			'asset.not-found',
		);

		expect(w.locks.isHeld(1, w.assetId)).toBe(false);
		const alive = await seeded();
		expect(expectOk(await alive.typed.execute({ assetId: alive.assetId, width: 1200, depth: 800 }))).toBe('wrote');
	});

	/**
	 * **The RESIDUAL, pinned as behaviour rather than described.** A lock only excludes
	 * participants that TAKE it, and exactly one deletion path does: `runDeleteResolution`. A
	 * caller that reaches `AssetRepository.delete` directly is not excluded, and the orphan this
	 * whole increment is about is still written.
	 *
	 * That is not a hypothetical corner. The delete a user can actually perform today is removing
	 * the asset note in Obsidian's file explorer, and that path never reaches
	 * `AssetGeometryStore.delete` at all — `VaultChangeAdapter.processPath` drops the index entry
	 * and leaves the `.rpgeo` where it is — so it orphans unconditionally, with or without any
	 * lock. `DeleteAssetCommand` meanwhile has no caller in `src/` outside its own composition,
	 * measured with `grep -rn deleteAsset src/`: it is composed, guarded, and dispatched only by
	 * tests. So the region this increment joins is real and its one participant is not yet
	 * reachable from any gesture, which is worth knowing before reading the cases above as
	 * closing the class.
	 *
	 * Staged deterministically rather than by timing: the sidecar's `write` performs the delete
	 * on its first call, which puts an UNLOCKED deletion exactly between this command's existence
	 * check and its write — the interleaving the report describes. The case therefore holds with
	 * the fix and without it, and it is here to say where the bound is rather than to discriminate
	 * a build.
	 */
	it('is NOT excluded from a delete that takes no lock, and still leaves an orphan', async () => {
		const stack = createRepositoryStack();
		const assetId = createAssetId();
		const real = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
		const saved = expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
		let deleteOnNextWrite = true;
		const sidecar = {
			read: (id: typeof assetId) => real.read(id),
			write: async (...args: Parameters<typeof real.write>) => {
				if (deleteOnNextWrite) {
					deleteOnNextWrite = false;
					// No lock taken — a raw repository caller, which is what every deletion path
					// other than `runDeleteResolution` is.
					expectOk(await stack.assets.delete(assetId, saved.version));
				}
				return await real.write(...args);
			},
		};
		const typed = new SetAssetFootprintFromDimensionsCommand({
			sidecar,
			assets: stack.assets,
			events: createEventBus(),
			locks: new ReferenceLocks(),
		});

		expect(expectOk(await typed.execute({ assetId, width: 1200, depth: 800 }))).toBe('wrote');

		expect(expectOk(await stack.assets.getById(assetId))).toBeNull();
		expect(stack.vault.entries.has(assetSidecarPathFor(stack.libraryFolder, assetId))).toBe(true);
	});

	/**
	 * The contrast case, and it is what stops the fix being "hold the lock forever": with nobody
	 * holding it, an ordinary design write is not delayed at all. A build that acquired and never
	 * released, or that awaited something it should not, passes every case above and fails this
	 * one.
	 */
	it('does not wait when nothing else holds the lock', async () => {
		const w = await seeded();

		let settled = false;
		const dispatch = w.typed.execute({ assetId: w.assetId, width: 1200, depth: 800 }).then((result) => {
			settled = true;
			return result;
		});
		await settle();

		expect(settled).toBe(true);
		expect(expectOk(await dispatch)).toBe('wrote');
		expect(w.sidecarExists()).toBe(true);
	});
});
