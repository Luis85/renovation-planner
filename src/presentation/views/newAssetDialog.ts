import type { Ref } from 'vue';
import type { Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { Asset } from '../../domain/asset/Asset';
import type { AssetId } from '../../domain/asset/AssetId';
import type { Logger } from '../../application/ports/Logger';
import type { CreateAssetInput } from '../../application/commands/asset/CreateAsset';
import type { SetAssetFootprintFromDimensionsInput } from '../../application/commands/asset/SetAssetFootprint';
import type { DispatchResult } from '../../application/commands/DispatchOutcome';
import type { useDialogStore } from '../dialogs/dialog-store';
import NewAssetForm from './NewAssetForm.vue';
import { tr } from '../i18n/strings';

/**
 * `New asset`, opened the one way — the guarded `createAsset`/`setAssetFootprintFromDimensions`
 * pair behind `NewAssetForm`. Each CALLER guards its own `dialogs.current !== null` before
 * reaching this function, which is what makes two clicks in one tick reach `openDialog` once
 * rather than throwing `DialogStackingError` — `deps.dialogs` here is `Pick<…, 'openDialog'>`
 * and cannot read `current` to guard it a second time.
 *
 * Two surfaces offer this gesture (the Renovation project view's `ViewRoot` and the Asset
 * library's own root) and `ViewRoot.onCreateAsset`'s docblock already described itself as
 * "`AssetLibraryRoot.onCreateAsset`'s identical sequence" — a claim about two copies rather
 * than one function, which is what this module makes true.
 *
 * **What it deliberately does NOT do is decide where the user goes next.** The two callers
 * differ in exactly that — the library selects what it made after refreshing its catalogue, the project view
 * opens it through `renovationProjectOpenAsset` — so this answers the created (or matched)
 * `AssetId` (or `null` for a cancel) and each caller keeps its own hand-off, along with its
 * refresh policy.
 */

/** One row of a `findExisting` match — enough for `SimilarNameHint` to name it and for a
 *  caller to select it, never a whole `CatalogueEntryDto`. */
export interface ExistingAsset {
	readonly assetId: AssetId;
	readonly name: string;
}

/**
 * `created: false` means the dialog resolved to an EXISTING asset through `SimilarNameHint`
 * rather than through `createAsset` — AL03's "a hint linking to existing results, not an
 * automatic merge". Both arms carry an `assetId` because both send the caller to the same
 * place (the asset designer, or the library's own selection); only the refresh policy differs,
 * which is why `created` and not the arm itself is what each caller branches on.
 */
export type NewAssetOutcome = { readonly assetId: AssetId; readonly created: boolean } | null;

export interface NewAssetDialogDeps {
	readonly dialogs: Pick<ReturnType<typeof useDialogStore>, 'openDialog'>;
	readonly busy: Ref<boolean>;
	/**
	 * Optional: the Renovation project view has no catalogue reachable from it to search, so
	 * only the Asset library's own `createAsset` supplies one. Absent, `NewAssetForm` draws no
	 * hint at all — never a lookup silently answering "nothing typed yet".
	 */
	readonly findExisting?: (name: string) => ExistingAsset | null;
	/**
	 * The command bundle, STRUCTURALLY — the three members this form needs, named as a shape
	 * rather than as either surface's own `…Commands` type, because the two callers hold
	 * different bundles. Taking the bundle rather than two hand-written adapter closures is what
	 * leaves each call site four lines: with the closures spelled at both, the two sites were
	 * still a clone group of their own after the sequence had been shared.
	 */
	readonly commands: {
		readonly createAsset: { execute(input: CreateAssetInput): Promise<Result<Asset, AppError>> };
		readonly setAssetFootprintFromDimensions: {
			execute(input: SetAssetFootprintFromDimensionsInput): Promise<DispatchResult>;
		};
		readonly defaultCurrency: string;
	};
	/**
	 * The form's own door for a dispatch that THROWS, which both of these being guarded
	 * commands means they cannot — but the guard is the ROOT's property, not this call site's,
	 * and `useFormCommit` requires the door rather than assuming the caller.
	 */
	readonly logger: Logger;
}

export async function openNewAssetDialog(deps: NewAssetDialogDeps): Promise<NewAssetOutcome> {
	const result = await deps.dialogs.openDialog({
		kind: 'form',
		title: tr('form.new-asset.title'),
		component: NewAssetForm,
		props: {
			createAsset: (input: CreateAssetInput) => deps.commands.createAsset.execute(input),
			setFootprintFromDimensions: (input: SetAssetFootprintFromDimensionsInput) =>
				deps.commands.setAssetFootprintFromDimensions.execute(input),
			busy: deps.busy,
			logger: deps.logger,
			defaultCurrency: deps.commands.defaultCurrency,
			findExisting: deps.findExisting,
		},
		busy: deps.busy,
	});
	if (result === 'cancel') return null;
	return result.values as NewAssetOutcome;
}
