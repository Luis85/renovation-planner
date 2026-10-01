/**
 * The designer's read model: the boundary between a view-state string and a branded `AssetId`,
 * and the refusal a session with no persistence hands over instead.
 *
 * Node, not jsdom — the mapping is a pure function of a query, and asking a function rather than
 * a screen is the return on the layering.
 */
import { describe, expect, it } from 'vitest';
import {
	createAssetDesignerQueries,
	unavailableAssetDesignerQueries,
} from '../../../src/presentation/read-models/assetDesignerQueries';
import type { AssetDesignDto, AssetDesignError } from '../../../src/application/queries/GetAssetDesign';
import type { AssetId } from '../../../src/domain/asset/AssetId';
import { isErr, isOk, ok, type Result } from '../../../src/core/result/Result';
import type { AssetPlanUsage } from '../../../src/application/queries/ListPlansUsingAsset';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import { assetDesign } from '../../helpers/assetDesign';
import { unwiredPlanUsage } from '../../helpers/designerQueries';

describe('createAssetDesignerQueries', () => {
	/**
	 * The id arrives from Obsidian's per-leaf view state, which is text a user can edit, and
	 * reaches the query as an `AssetId`. The brand has no runtime representation, so what this
	 * pins is that the mapping PASSES THE ID THROUGH rather than dropping it — a wrapper that
	 * called `execute()` with nothing would type-check under the assertion the mapping makes and
	 * answer about whichever asset the query defaulted to.
	 */
	it('hands the view-state id to the query and its answer straight back', async () => {
		const design = assetDesign();
		const asked: AssetId[] = [];
		const queries = createAssetDesignerQueries(
			{
				get: {
					execute: (assetId: AssetId): Promise<Result<AssetDesignDto, AssetDesignError>> => {
						asked.push(assetId);
						return Promise.resolve(ok(design));
					},
				},
			},
			{ execute: unwiredPlanUsage },
		);

		const result = await queries.getAssetDesign(design.assetId);

		expect(asked).toEqual([design.assetId]);
		expect(isOk(result) && result.value).toBe(design);
	});

	/**
	 * The same pass-through for AD13-R1's usage scope, and it is a SECOND case rather than a
	 * widening of the one above because the two map different queries: a wrapper that handed the
	 * design query's id to the scope query — or its own `assetId` to neither — would satisfy that
	 * case completely.
	 *
	 * The answer is asserted by IDENTITY (`toBe`), not by shape: the read model's whole job here is
	 * to hand `ListPlansUsingAsset`'s `Result` on verbatim, and a version that rebuilt an
	 * equivalent object would be a second answer to what the scope is.
	 */
	it('hands the view-state id to the usage query and its answer straight back', async () => {
		const design = assetDesign();
		const asked: AssetId[] = [];
		const usage: Result<AssetPlanUsage, RepositoryError> = ok({ plans: [], unreadable: 3 });
		const queries = createAssetDesignerQueries(
			{ get: { execute: () => Promise.resolve(ok(design)) } },
			{
				execute: (assetId: AssetId): Promise<Result<AssetPlanUsage, RepositoryError>> => {
					asked.push(assetId);
					return Promise.resolve(usage);
				},
			},
		);

		const result = await queries.listPlansUsingAsset(design.assetId);

		expect(asked).toEqual([design.assetId]);
		expect(result).toBe(usage);
	});
});

describe('unavailableAssetDesignerQueries', () => {
	/**
	 * `settings.unrecovered` SPECIFICALLY, and not merely "some error": `viewHydrationOrigin`
	 * reads that exact code to decide the failure is a bootstrap one and gets no retry button.
	 * A refusal under any other code would draw a live control that re-runs nothing.
	 */
	it('refuses with the code that marks a bootstrap failure', async () => {
		const result = await unavailableAssetDesignerQueries().getAssetDesign('asset-01JABC');

		expect(isErr(result) && result.error.code).toBe('settings.unrecovered');
		expect(isErr(result) && result.error.category).toBe('Persistence');
	});

	/**
	 * **The bundle is TOTAL** (AD13-R1's closing line: the unavailable bundle gains its arm in the
	 * same edit as the member). By EXACT KEY SET rather than by naming the two, for CLAUDE.md's
	 * carve-out rule: the next member added to `AssetDesignerQueryServices` reddens THIS line,
	 * which is where a person is standing when they decide what that member refuses with.
	 *
	 * **Read it narrowly.** The compiler already forces a key to exist — an incomplete object
	 * literal does not type-check — so what this adds is the PROMPT, not the guarantee. What
	 * neither reaches is a member whose arm succeeds: the two cases beside this one are what say
	 * `settings.unrecovered` and `Persistence` out loud, one per member.
	 */
	it('declares an arm for every member, by exact key set', () => {
		expect(Object.keys(unavailableAssetDesignerQueries()).toSorted()).toEqual([
			'getAssetDesign',
			'listPlansUsingAsset',
		]);
	});

	/**
	 * The scope's own arm, at its own door: a refusal whose CATEGORY was anything but
	 * `Persistence` would route to a different sentence through `trError`, and
	 * `DesignerUsageScope` draws that sentence as its unknown-scope state.
	 */
	it('refuses the usage scope as a persistence failure', async () => {
		const result = await unavailableAssetDesignerQueries().listPlansUsingAsset('asset-01JABC');

		expect(isErr(result) && result.error.category).toBe('Persistence');
	});
});
