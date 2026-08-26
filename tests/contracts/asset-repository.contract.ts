import { describe, expect, it } from 'vitest';
import type { AssetRepository } from '../../src/application/ports/AssetRepository';
import type { EntityVersion } from '../../src/application/ports/versioning';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { AssetId } from '../../src/domain/asset/AssetId';
import { expectErr, expectOk } from '../helpers/domain';
import { makeAsset } from '../helpers/entities';
import { expectIdKeyedUpsert } from './upsert';

/**
 * The shared AssetRepository contract (SDD §72) — the same terms every entity port takes:
 * conditional reads and writes, `'absent'` inserts, revision/token compare-and-swap.
 */
export interface AssetFixture {
	readonly repository: AssetRepository;
	/** Simulates an out-of-band byte change: token moves, revision does not. */
	touch(id: AssetId): void;
	otherProject(): ProjectId;
}

function fabricated(observed: EntityVersion['observed']): EntityVersion {
	return { revision: 99, observed };
}

/** One fresh asset, already inserted — the pre-state most conditional terms need. */
async function seedWritten(f: AssetFixture) {
	const asset = makeAsset({ projectId: f.otherProject() });
	const written = expectOk(await f.repository.save(asset, 'absent'));
	return { asset, written };
}

export function assetRepositoryContract(make: () => AssetFixture): void {
	describe('AssetRepository contract', () => {
		it('getById answers ok(null) for a missing id', async () => {
			const f = make();
			const asset = makeAsset({ projectId: f.otherProject() });
			expect(await f.repository.getById(asset.id)).toEqual({ ok: true, value: null });
		});

		it("save with 'absent' inserts at revision 1 and reads back", async () => {
			const f = make();
			const asset = makeAsset({ projectId: f.otherProject() });
			const written = expectOk(await f.repository.save(asset, 'absent'));
			expect(written.version.revision).toBe(1);
			expect(expectOk(await f.repository.getById(asset.id))?.entity.name).toBe(asset.name);
		});

		it('save is an ID-keyed upsert when given the version it returned', async () => {
			const f = make();
			const written = await expectIdKeyedUpsert({
				repository: f.repository,
				entity: makeAsset({ projectId: f.otherProject() }),
				replacementName: 'After',
			});
			expect(written.version.revision).toBe(2);
		});

		it("save with 'absent' refuses when something already holds the id", async () => {
			const f = make();
			const asset = makeAsset({ projectId: f.otherProject() });
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
			const stranger = makeAsset({ projectId: f.otherProject() });
			expect((await f.repository.delete(stranger.id, written.version)).ok).toBe(false);
		});

		it('listByProject returns only its own assets', async () => {
			const f = make();
			const target = f.otherProject();
			const elsewhere = f.otherProject();
			expectOk(await f.repository.save(makeAsset({ projectId: target, name: 'A' }), 'absent'));
			expectOk(await f.repository.save(makeAsset({ projectId: target, name: 'B' }), 'absent'));
			expectOk(await f.repository.save(makeAsset({ projectId: elsewhere, name: 'C' }), 'absent'));
			expect(expectOk(await f.repository.listByProject(target)).map((a) => a.entity.name)).toEqual(['A', 'B']);
		});
	});
}
