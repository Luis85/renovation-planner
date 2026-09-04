import { describe, expect, it, vi } from 'vitest';
import { ListProjectAssetPrices, compareAssetPriceRows, type AssetPriceRowDto } from '../../../src/application/queries/ListProjectAssetPrices';
import { InMemoryAssetRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetRepository';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { InMemoryProjectIndex } from '../../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { AssetPriceOverride } from '../../../src/domain/asset-price/AssetPriceOverride';
import { createAssetPriceOverrideId } from '../../../src/domain/asset-price/AssetPriceOverrideId';
import { of as moneyOf } from '../../../src/core/money/Money';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { expectErr, expectOk, injectedReadFailure } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { makeOverride } from '../../contracts/asset-price-override-repository.contract';

/** Swaps in a patched method on a real collaborator, keeping its prototype and every other
 *  member — the shape `queryRefusals.test.ts` already uses for the same purpose. */
function overridePort<T extends object>(inner: T, patch: Record<string, unknown>): T {
	return Object.assign(Object.create(Object.getPrototypeOf(inner)), inner, patch) as T;
}

function wired() {
	const assets = new InMemoryAssetRepository();
	const overrides = new InMemoryAssetPriceOverrideRepository();
	const index = new InMemoryProjectIndex();
	type Line = (event: string, context?: Record<string, unknown>) => void;
	const logger = {
		debug: vi.fn<Line>(),
		info: vi.fn<Line>(),
		warn: vi.fn<Line>(),
		error: vi.fn<Line>(),
	};
	const query = new ListProjectAssetPrices(assets, overrides, index, logger);
	const projectId = createProjectId();
	return { assets, overrides, index, logger, query, projectId };
}

describe('ListProjectAssetPrices', () => {
	it('returns one row per catalogue asset, with a null override where the project has none', async () => {
		const { assets, query, projectId } = wired();
		const asset = makeAsset({ name: 'Oak flooring', unitCost: moneyOf('45.00', 'EUR') });
		expectOk(await assets.save(asset, 'absent'));

		const rows = expectOk(await query.execute(projectId));

		expect(rows).toEqual([
			{
				assetId: asset.id,
				assetName: 'Oak flooring',
				catalogue: asset.unitCost,
				override: null,
				overrideId: null,
				overrideVersion: null,
				assetStatus: 'known',
			},
		]);
	});

	it('warns once and returns the winner when a project has two notes for one asset', async () => {
		const { assets, overrides, query, projectId, logger } = wired();
		const asset = makeAsset({ name: 'Oak flooring' });
		expectOk(await assets.save(asset, 'absent'));
		const first = expectOk(
			await overrides.save(
				expectOk(
					AssetPriceOverride.create({
						id: createAssetPriceOverrideId(),
						projectId,
						assetId: asset.id,
						unitCost: moneyOf('19.50', 'EUR'),
					}),
				),
				'absent',
			),
		);
		const second = expectOk(
			await overrides.save(
				expectOk(
					AssetPriceOverride.create({
						id: createAssetPriceOverrideId(),
						projectId,
						assetId: asset.id,
						unitCost: moneyOf('21.00', 'EUR'),
					}),
				),
				'absent',
			),
		);
		const winner = first.entity.id > second.entity.id ? first : second;

		const rows = expectOk(await query.execute(projectId));

		expect(rows).toHaveLength(1);
		expect(rows[0]?.overrideId).toBe(winner.entity.id);
		expect(rows[0]?.override?.amount).toBe(winner.entity.unitCost.amount);
		expect(logger.warn).toHaveBeenCalledWith('asset-price.duplicate-pair', {
			projectId,
			assetId: asset.id,
			count: 2,
		});
	});

	it('carries the override id and revision so a row can be cleared without a second read', async () => {
		const { assets, overrides, query, projectId } = wired();
		const asset = makeAsset({ name: 'Oak flooring' });
		expectOk(await assets.save(asset, 'absent'));
		expectOk(await overrides.save(makeOverride(projectId, asset.id), 'absent'));

		const rows = expectOk(await query.execute(projectId));

		const row = rows.find((r) => r.assetId === asset.id);
		expect(row?.overrideId).not.toBeNull();
		expect(row?.overrideVersion).not.toBeNull();
	});

	it('is sorted by asset name, so the list does not reshuffle between reads', async () => {
		const { assets, query, projectId } = wired();
		const zebra = makeAsset({ name: 'Zebrano veneer' });
		const acacia = makeAsset({ name: 'Acacia worktop' });
		const marble = makeAsset({ name: 'Marble tile' });
		expectOk(await assets.save(zebra, 'absent'));
		expectOk(await assets.save(acacia, 'absent'));
		expectOk(await assets.save(marble, 'absent'));

		const rows = expectOk(await query.execute(projectId));

		expect(rows.map((r) => r.assetName)).toEqual(['Acacia worktop', 'Marble tile', 'Zebrano veneer']);
	});

	it('returns an empty list for a vault whose library is empty', async () => {
		const { query, projectId } = wired();

		const rows = expectOk(await query.execute(projectId));

		expect(rows).toEqual([]);
	});

	/**
	 * The ORPHAN, and the case a catalogue-only join cannot pass: an override whose asset was
	 * deleted OUT OF BAND — deletes the note, so the id is gone from BOTH `listAll` and
	 * `index.getIdsByType`. `VaultChangeAdapter.onDelete` drops the index entry and dispatches
	 * no command, which is what Task 7a's cleanup never ran against.
	 */
	it('lists an override whose asset was deleted out of band, with no name and no library price', async () => {
		const { assets, overrides, index, query, projectId } = wired();
		const asset = makeAsset({ name: 'Reclaimed brick' });
		const saved = expectOk(await assets.save(asset, 'absent'));
		expectOk(await overrides.save(makeOverride(projectId, asset.id), 'absent'));

		// The note is gone: absent from `listAll` AND from the index.
		expectOk(await assets.delete(asset.id, saved.version));
		index.remove(asset.id);

		const rows = expectOk(await query.execute(projectId));

		const orphan = rows.find((r) => r.assetId === asset.id);
		expect(orphan?.assetName).toBeNull();
		expect(orphan?.catalogue).toBeNull();
		expect(orphan?.overrideId).not.toBeNull();
		expect(orphan?.overrideVersion).not.toBeNull();
		expect(orphan?.assetStatus).toBe('orphan');
	});

	/**
	 * The defect a review bot found: an override whose asset note still EXISTS but fails to
	 * parse is absent from `listAll` exactly as a deleted note is, but its id stays IN the
	 * Project Index — seeded directly into the fake `ProjectIndex`, which is the only fixture
	 * that can produce "readable id, unreadable note" at all.
	 */
	it('lists an override whose asset note is malformed as unreadable, not orphaned', async () => {
		const { overrides, index, query, projectId } = wired();
		const assetId = createAssetId();
		expectOk(await overrides.save(makeOverride(projectId, assetId), 'absent'));
		// The note exists and declares `type`/`id` — it just never entered `listAll()`.
		index.upsert({ id: assetId, type: 'renovation-asset', path: `Renovation/Library/${assetId}.md` });

		const rows = expectOk(await query.execute(projectId));

		const unreadable = rows.find((r) => r.assetId === assetId);
		expect(unreadable?.assetName).toBeNull();
		expect(unreadable?.catalogue).toBeNull();
		expect(unreadable?.overrideId).not.toBeNull();
		expect(unreadable?.overrideVersion).not.toBeNull();
		expect(unreadable?.assetStatus).toBe('unreadable');
	});

	it('puts orphan and unreadable rows after every named row, ordered by asset id', async () => {
		const { assets, overrides, index, query, projectId } = wired();
		const named = makeAsset({ name: 'Aardvark tile' });
		expectOk(await assets.save(named, 'absent'));

		const orphanId = createAssetId();
		const unreadableId = createAssetId();
		// Seeded so the two ids sort predictably against each other: whichever is smaller comes
		// first among the unhappy rows, and BOTH come after the named row regardless of id.
		const [firstId, secondId] = [orphanId, unreadableId].toSorted((a, b) => a.localeCompare(b));
		expectOk(await overrides.save(makeOverride(projectId, orphanId), 'absent'));
		expectOk(await overrides.save(makeOverride(projectId, unreadableId), 'absent'));
		index.upsert({ id: unreadableId, type: 'renovation-asset', path: 'Renovation/Library/u.md' });

		const rows = expectOk(await query.execute(projectId));

		expect(rows.map((r) => r.assetId)).toEqual([named.id, firstId, secondId]);
	});

	/**
	 * Nothing refuses a duplicate asset NAME, and without an id tie-break the pair falls back
	 * to `listAll` order — which `InMemoryProjectIndex` (SUT for its note-backed sibling) is
	 * not the source of, but `listAll` order is `VersionedStore.values()`'s own insertion
	 * order, which does not reorder on an update. Assert the order is the SAME across two
	 * reads with an update in between — a single-read assertion passes against the defect.
	 */
	/**
	 * `InMemoryAssetRepository` backs `listAll()` with a `Map`, which does not reorder on an
	 * update — so this case cannot rely on the real fake to reproduce the instability it is
	 * about. `ObsidianAssetRepository.listAll()` is built from `index.getIdsByType`, and
	 * `InMemoryProjectIndex.upsert` DOES move an updated entry to the end of its `Set`
	 * (`:37-42`), which is the reordering this test stands in for directly: a fake `listAll`
	 * that answers the SAME two rows in a DIFFERENT order the second time, the way the real
	 * pipeline's order can change with no asset having moved between reads.
	 */
	it('keeps two same-named assets in the same order across an update', async () => {
		const { assets, overrides, index, logger, projectId } = wired();
		const first = makeAsset({ name: 'Oak flooring' });
		const second = makeAsset({ name: 'Oak flooring' });
		const savedFirst = expectOk(await assets.save(first, 'absent'));
		const savedSecond = expectOk(await assets.save(second, 'absent'));

		let reordered = false;
		const reorderingAssets = overridePort(assets, {
			listAll: async () => {
				const listing = expectOk(await assets.listAll());
				const ordered = reordered ? listing.loaded.toReversed() : listing.loaded;
				return { ok: true as const, value: { ...listing, loaded: ordered } };
			},
		});
		const query = new ListProjectAssetPrices(reorderingAssets, overrides, index, logger);

		const before = expectOk(await query.execute(projectId));
		reordered = true;
		const after = expectOk(await query.execute(projectId));

		// The two rows share a name, so nothing but the id tie-break can be holding this order
		// steady — asserted against the fixture's own reversed `listAll`, which really did
		// flip: `savedFirst`/`savedSecond` are not interchangeable in the assertion above them.
		expect(before.map((r) => r.assetId)).toEqual([savedFirst.entity.id, savedSecond.entity.id].toSorted());
		expect(after.map((r) => r.assetId)).toEqual(before.map((r) => r.assetId));
	});

	it('propagates a failed catalogue read', async () => {
		const { assets, overrides, index, logger, projectId } = wired();
		const failingAssets = overridePort(assets, {
			listAll: () => Promise.resolve(injectedReadFailure()),
		});
		const query = new ListProjectAssetPrices(failingAssets, overrides, index, logger);

		const error = expectErr(await query.execute(projectId));

		expect(error.code).toBe('test.injected-failure');
	});

	it('propagates a failed override read', async () => {
		const { assets, overrides, index, logger, projectId } = wired();
		const failingOverrides = overridePort(overrides, {
			listByProject: () => Promise.resolve(injectedReadFailure()),
		});
		const query = new ListProjectAssetPrices(assets, failingOverrides, index, logger);

		const error = expectErr(await query.execute(projectId));

		expect(error.code).toBe('test.injected-failure');
	});
});

/**
 * `compareAssetPriceRows` directly, bypassing `Array.prototype.sort` entirely — `execute`'s
 * own pre-sort array always places every named row before every unhappy one, and V8's sort
 * (measured in `ListProjectAssetPrices.ts`'s own docblock) never calls a comparator with a
 * named row as `a` against an unhappy row as `b` given that shape, so a case that goes
 * through `execute` can drive only the reverse pairing. Both directions have to be asked of
 * the function itself for the comparator's own symmetry to be checked at all.
 */
describe('compareAssetPriceRows', () => {
	const named: AssetPriceRowDto = {
		assetId: 'asset-named',
		assetName: 'Oak flooring',
		catalogue: moneyOf('45.00', 'EUR'),
		override: null,
		overrideId: null,
		overrideVersion: null,
		assetStatus: 'known',
	};
	const unhappy: AssetPriceRowDto = {
		assetId: 'asset-unhappy',
		assetName: null,
		catalogue: null,
		override: moneyOf('19.50', 'EUR'),
		overrideId: null,
		overrideVersion: null,
		assetStatus: 'orphan',
	};

	it('puts the unhappy row after the named one, unhappy first', () => {
		expect(compareAssetPriceRows(unhappy, named)).toBeGreaterThan(0);
	});

	it('puts the unhappy row after the named one, named first', () => {
		expect(compareAssetPriceRows(named, unhappy)).toBeLessThan(0);
	});

	it('orders two unhappy rows by id', () => {
		const other: AssetPriceRowDto = { ...unhappy, assetId: 'asset-unhappy-2' };
		expect(compareAssetPriceRows(unhappy, other)).toBeLessThan(0);
		expect(compareAssetPriceRows(other, unhappy)).toBeGreaterThan(0);
	});

	it('orders two named rows by name, then by id on a tie', () => {
		const other: AssetPriceRowDto = { ...named, assetId: 'asset-named-2', assetName: 'Oak flooring' };
		expect(compareAssetPriceRows(named, other)).toBeLessThan(0);
	});
});

