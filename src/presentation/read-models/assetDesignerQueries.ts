import { err, type Result } from '../../core/result/Result';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Query } from '../../application/queries/Query';
import type { AssetDesignDto, AssetDesignError } from '../../application/queries/GetAssetDesign';
import type { AssetPlanUsage } from '../../application/queries/ListPlansUsingAsset';
import type { PersistenceError } from '../../core/errors/AppError';
import type { RepositoryError } from '../../application/ports/repositoryErrors';

/**
 * The ONLY application-layer surface the asset designer depends on — `planEditorQueries.ts`'s
 * shape for a second view (design slice B3, ADR-0015).
 *
 * **TWO members**, and the second is not a second way to read a design. `GetAssetDesign` already
 * joins the note and the geometry sidecar into a single DTO, so there is no other door for a view
 * to assemble a design out of; `listPlansUsingAsset` answers a different question entirely —
 * which PLANS place this definition — and it is here because ruling AD13-R1 owes the designer an
 * impact scope before it lets a user rewrite geometry every one of those plans draws. Counted
 * from the interface below rather than remembered: this header read "one member" for as long as
 * that was true and is the kind of sentence nothing re-runs, so
 * `tests/presentation/read-models/assetDesignerQueries.test.ts` asserts the member NAMES by exact
 * key set rather than describing them.
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
	/**
	 * Which plans place this definition — ruling AD13-R1's usage scope, the same
	 * `ListPlansUsingAsset` the Asset library's own scope panel asks and NOT a designer copy of
	 * it: `guardAssetUsage` composes and guards it once for both surfaces.
	 *
	 * `assetId` is a plain `string` here for the reason this interface's `getAssetDesign` gives —
	 * the designer's id comes out of Obsidian's per-leaf view state, which is text a user can
	 * edit, so the boundary assertion happens once, below.
	 *
	 * The `Result` is handed on verbatim, exactly as `getAssetDesign`'s is: a scope that could not
	 * be read and a scope that is genuinely empty are the difference between a safe edit and a
	 * blind one, and flattening the refusal into an empty `AssetPlanUsage` would understate the
	 * blast radius of the very edit this member is consulted about.
	 */
	listPlansUsingAsset(
		assetId: string,
	): Promise<Result<AssetPlanUsage, RepositoryError | PersistenceError>>;
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
 *
 * **Every member refuses, which is what TOTAL means here.** The usage scope gained its arm in the
 * same edit that gained the member (ruling AD13-R1 asks for exactly that): a bundle that refused
 * for one member and answered `undefined` for the other would put a branch in every consumer, and
 * the consumer of this one draws a blast radius — where the difference between *could not read*
 * and *nothing to read* is the whole of its content.
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
		listPlansUsingAsset: () =>
			Promise.resolve(
				err<PersistenceError>({
					category: 'Persistence',
					code: 'settings.unrecovered',
					message: 'Settings could not be read, so the plans that place this asset cannot be listed.',
				}),
			),
	};
}

/**
 * The guarded `assetDesign.get` query (Task A9) and the guarded usage scope (ruling AD13-R1),
 * mapped at the boundary into the read model above.
 *
 * The `as AssetId` is the same boundary assertion every other edge of this system makes about
 * an id it was handed as text — `ObsidianAssetRepository` does it for a frontmatter value, this
 * does it for a view-state one. The brand has no runtime representation, so there is nothing to
 * validate here; what makes the id real is that the query refuses one that names nothing.
 *
 * The scope arrives as its OWN parameter rather than as a second member of the design bundle,
 * because it is not one: `persistence.assetDesign` is the asset-design service group, and
 * `guardAssetUsage` composes this query from the project and plan ports beside it. Typed
 * structurally (`Query<…>`) like every parameter here, for `guardedServices.ts`'s stated reason —
 * what the composition root hands out is a wrapper with the same `execute`, and a parameter typed
 * as the concrete class would refuse it.
 */
export function createAssetDesignerQueries(
	queries: {
		readonly get: Query<AssetId, Result<AssetDesignDto, AssetDesignError>>;
	},
	usage: Query<AssetId, Result<AssetPlanUsage, RepositoryError | PersistenceError>>,
): AssetDesignerQueryServices {
	return {
		getAssetDesign: (assetId) => queries.get.execute(assetId as AssetId),
		listPlansUsingAsset: (assetId) => usage.execute(assetId as AssetId),
	};
}
