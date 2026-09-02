import { err, type Result } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Query } from '../../application/queries/Query';
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';

/**
 * The ONLY application-layer surface the asset designer depends on — `planEditorQueries.ts`'s
 * shape for a second view (design slice B3, ADR-0015).
 *
 * One member, because the designer reads one thing: `GetAssetDesign` already joins the note
 * and the geometry sidecar into a single DTO, so there is no second door for a view to
 * assemble a design out of.
 *
 * The result is handed on **verbatim in shape**. `GetAssetDesign` refuses an absent asset with
 * a coded `ReferenceError` rather than answering `ok(null)`, and a failed vault read propagates
 * as the repository's own error — flattening either into `AssetDesignDto | null` would make
 * "no such asset" and "the vault read failed" indistinguishable, which is the distinction the
 * error-surface policy branches on and neither could recover afterwards.
 *
 * `assetId` is a plain `string` here and an `AssetId` below, and that asymmetry is the same one
 * `createPlanEditorQueries` draws: the view's id comes out of Obsidian's per-leaf view state,
 * which is text a user can edit, so the boundary assertion happens once, HERE, where the
 * mapping from view state to query input actually is.
 */
export interface AssetDesignerQueryServices {
	getAssetDesign(assetId: string): Promise<Result<AssetDesignDto, AssetDesignError>>;
}

/**
 * A session whose settings could not be recovered composed no persistence at all, so there is
 * no query to hand over.
 *
 * TOTAL rather than nullable, exactly as `unavailablePlanEditorQueries` is: a refusing bundle
 * lets the view draw the same failure state it draws for any unreadable asset, where a nullable
 * dependency would put a branch in every consumer and not registering the view at all would
 * leave a restored designer leaf pointing at a view type Obsidian does not know.
 *
 * The code is `settings.unrecovered`, which is what `viewHydrationOrigin` reads to decide that
 * this failure gets NO retry: nothing was composed to re-run, so a retry button would be a
 * live control that does nothing.
 */
export function unavailableAssetDesignerQueries(): AssetDesignerQueryServices {
	return {
		getAssetDesign: () =>
			Promise.resolve(
				err<AssetDesignError>({
					category: 'Persistence',
					code: 'settings.unrecovered',
					message: 'Settings could not be read, so no asset design can be loaded.',
				}),
			),
	};
}

/**
 * The guarded `assetDesign.get` query (Task A9), mapped at the boundary into the read model
 * above.
 *
 * The `as AssetId` is the same boundary assertion every other edge of this system makes about
 * an id it was handed as text — `ObsidianAssetRepository` does it for a frontmatter value, this
 * does it for a view-state one. The brand has no runtime representation, so there is nothing to
 * validate here; what makes the id real is that the query refuses one that names nothing.
 */
export function createAssetDesignerQueries(queries: {
	readonly get: Query<AssetId, Result<AssetDesignDto, AssetDesignError>>;
}): AssetDesignerQueryServices {
	return {
		getAssetDesign: (assetId) => queries.get.execute(assetId as AssetId),
	};
}
