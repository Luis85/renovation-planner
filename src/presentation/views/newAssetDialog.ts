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
 * pair behind `NewAssetForm`, inside the `dialogs.current !== null` guard that makes two clicks
 * in one tick reach `openDialog` once rather than throwing `DialogStackingError`.
 *
 * Two surfaces offer this gesture (the Renovation project view's `ViewRoot` and the Asset
 * library's own root) and `ViewRoot.onCreateAsset`'s docblock already described itself as
 * "`AssetLibraryRoot.onCreateAsset`'s identical sequence" — a claim about two copies rather
 * than one function, which is what this module makes true.
 *
 * **What it deliberately does NOT do is decide where the user goes next.** The two callers
 * differ in exactly that — the library opens the designer on what it made, the project view
 * opens it through `renovationProjectOpenAsset` — so this answers the created `AssetId` (or
 * `null` for a cancel) and each caller keeps its own hand-off, along with the reason it does
 * not re-hydrate.
 */
export interface NewAssetDialogDeps {
	readonly dialogs: Pick<ReturnType<typeof useDialogStore>, 'openDialog'>;
	readonly busy: Ref<boolean>;
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

export async function openNewAssetDialog(deps: NewAssetDialogDeps): Promise<AssetId | null> {
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
		},
		busy: deps.busy,
	});
	if (result === 'cancel') return null;
	return result.values as AssetId;
}
