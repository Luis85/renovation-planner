import { describe, expect, it } from 'vitest';
import { ListOverridingProjects } from '../../../src/application/queries/ListOverridingProjects';
import { InMemoryAssetPriceOverrideRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { createAssetId } from '../../../src/domain/asset/AssetId';
import { createProjectId } from '../../../src/domain/project/ProjectId';
import { err } from '../../../src/core/result/Result';
import type { AssetPriceOverrideRepository } from '../../../src/application/ports/AssetPriceOverrideRepository';
import { expectErr, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { makeOverride } from '../../contracts/asset-price-override-repository.contract';

/**
 * §11 item 6's read: which projects a price edit will NOT reach.
 *
 * The answer is a set of project ids and nothing else — no amount, no id of the override
 * itself — because the *Used in* row it marks already carries the project, and a vault-wide
 * surface has no business asserting a project's own price (§3.5).
 */
describe('ListOverridingProjects', () => {
	it('answers the projects holding an override for the asset, and no others', async () => {
		const overrides = new InMemoryAssetPriceOverrideRepository();
		const tiles = createAssetId();
		const paint = createAssetId();
		const kitchen = createProjectId();
		const bathroom = createProjectId();
		expectOk(await overrides.save(makeOverride(kitchen, tiles), 'absent'));
		expectOk(await overrides.save(makeOverride(bathroom, tiles), 'absent'));
		// A second asset in the same vault: an implementation listing every override there is
		// would pass without this row and mark projects that override something else entirely.
		expectOk(await overrides.save(makeOverride(createProjectId(), paint), 'absent'));

		const answered = expectOk(await new ListOverridingProjects(overrides).execute(tiles));

		expect([...answered].toSorted()).toEqual([kitchen, bathroom].toSorted());
	});

	/**
	 * Uniqueness is on the (project, asset) PAIR and nothing enforces it — two notes for one
	 * pair are a diagnostic and last-writer-wins, never a refusal — so the raw list can hold
	 * the same project twice. The *Used in* row is keyed by `projectId`, so a duplicated id
	 * here is a marked row asked about twice.
	 */
	it('names a project once when two notes hold an override for the same pair', async () => {
		const overrides = new InMemoryAssetPriceOverrideRepository();
		const tiles = createAssetId();
		const kitchen = createProjectId();
		expectOk(await overrides.save(makeOverride(kitchen, tiles, '19.50'), 'absent'));
		expectOk(await overrides.save(makeOverride(kitchen, tiles, '21.00'), 'absent'));

		const answered = expectOk(await new ListOverridingProjects(overrides).execute(tiles));

		expect(answered).toEqual([kitchen]);
	});

	it('propagates a failed read rather than reporting no overrides', async () => {
		// The two are opposite claims: "no project overrides this" makes a price edit look
		// safe, and a read that failed cannot say so.
		const failing = {
			listByAsset: () => Promise.resolve(err(injectedPersistenceError())),
		} as unknown as AssetPriceOverrideRepository;

		const refusal = expectErr(await new ListOverridingProjects(failing).execute(createAssetId()));

		expect(refusal.code).toBe('test.injected-failure');
	});
});
