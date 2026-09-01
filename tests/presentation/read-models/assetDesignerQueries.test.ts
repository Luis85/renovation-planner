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
import { assetDesign } from '../../helpers/assetDesign';

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
		const queries = createAssetDesignerQueries({
			get: {
				execute: (assetId: AssetId): Promise<Result<AssetDesignDto, AssetDesignError>> => {
					asked.push(assetId);
					return Promise.resolve(ok(design));
				},
			},
		});

		const result = await queries.getAssetDesign(design.assetId);

		expect(asked).toEqual([design.assetId]);
		expect(isOk(result) && result.value).toBe(design);
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
});
