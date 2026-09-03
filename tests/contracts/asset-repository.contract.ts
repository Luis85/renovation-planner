import { describe, expect, it } from 'vitest';
import type { AssetRepository } from '../../src/application/ports/AssetRepository';
import type { EntityVersion } from '../../src/application/ports/versioning';
import type { AssetId } from '../../src/domain/asset/AssetId';
import { expectErr, expectOk } from '../helpers/domain';
import { makeAsset } from '../helpers/entities';
import { expectIdKeyedUpsert } from './upsert';

/**
 * The shared AssetRepository contract (SDD §72) — the same terms every entity port takes:
 * conditional reads and writes, `'absent'` inserts, revision/token compare-and-swap.
 */
/**
 * No `otherProject()` here, unlike every other entity fixture: since design slice 19 an
 * Asset belongs to no project, so there is no owning project for a fixture to mint and no
 * per-project list to narrow.
 */
export interface AssetFixture {
	readonly repository: AssetRepository;
	/** Simulates an out-of-band byte change: token moves, revision does not. */
	touch(id: AssetId): void;
}

function fabricated(observed: EntityVersion['observed']): EntityVersion {
	return { revision: 99, observed };
}

/** One fresh asset, already inserted — the pre-state most conditional terms need. */
async function seedWritten(f: AssetFixture) {
	const asset = makeAsset();
	const written = expectOk(await f.repository.save(asset, 'absent'));
	return { asset, written };
}

export function assetRepositoryContract(make: () => AssetFixture): void {
	describe('AssetRepository contract', () => {
		it('getById answers ok(null) for a missing id', async () => {
			const f = make();
			const asset = makeAsset();
			expect(await f.repository.getById(asset.id)).toEqual({ ok: true, value: null });
		});

		it("save with 'absent' inserts at revision 1 and reads back", async () => {
			const f = make();
			const asset = makeAsset();
			const written = expectOk(await f.repository.save(asset, 'absent'));
			expect(written.version.revision).toBe(1);
			expect(expectOk(await f.repository.getById(asset.id))?.entity.name).toBe(asset.name);
		});

		it('save is an ID-keyed upsert when given the version it returned', async () => {
			const f = make();
			const written = await expectIdKeyedUpsert({
				repository: f.repository,
				entity: makeAsset(),
				replacementName: 'After',
			});
			expect(written.version.revision).toBe(2);
		});

		it("save with 'absent' refuses when something already holds the id", async () => {
			const f = make();
			const asset = makeAsset();
			expectOk(await f.repository.save(asset, 'absent'));
			expect((await f.repository.save(asset, 'absent')).ok).toBe(false);
		});

		it('save refuses a stale revision', async () => {
			const f = make();
			const { asset, written } = await seedWritten(f);
			const error = expectErr(await f.repository.save(asset, fabricated(written.version.observed)));
			expect(error.code).toBe('asset.revision-conflict');
		});

		it('save refuses after an external modification', async () => {
			const f = make();
			const { asset, written } = await seedWritten(f);
			f.touch(asset.id);
			const error = expectErr(
				await f.repository.save(asset, {
					revision: written.version.revision,
					observed: written.version.observed,
				}),
			);
			expect(error.code).toBe('asset.external-modification');
		});

		it('delete removes conditionally', async () => {
			const f = make();
			const { asset, written } = await seedWritten(f);
			await f.repository.delete(asset.id, written.version);
			expect(await f.repository.getById(asset.id)).toEqual({ ok: true, value: null });
		});

		it('delete refuses a stale expectation or an unknown id', async () => {
			const f = make();
			const { asset, written } = await seedWritten(f);
			expect(
				(await f.repository.delete(asset.id, fabricated(written.version.observed))).ok,
			).toBe(false);
			const stranger = makeAsset();
			expect((await f.repository.delete(stranger.id, written.version)).ok).toBe(false);
		});

		it('listAll returns the whole vault catalogue, narrowed by no project', async () => {
			const f = make();
			expectOk(await f.repository.save(makeAsset({ name: 'A' }), 'absent'));
			expectOk(await f.repository.save(makeAsset({ name: 'B' }), 'absent'));
			expectOk(await f.repository.save(makeAsset({ name: 'C' }), 'absent'));
			const listing = expectOk(await f.repository.listAll());
			expect(listing.loaded.map((a) => a.entity.name).toSorted()).toEqual(['A', 'B', 'C']);
			expect(listing.skipped).toEqual([]);
		});
	});
}
