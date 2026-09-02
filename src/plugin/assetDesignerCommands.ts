import { isErr } from '../core/result/Result';
import type { Asset } from '../domain/asset/Asset';
import { revealAssetDesigner } from '../infrastructure/obsidian/workspace/revealAssetDesigner';
import { AssetSuggestModal } from '../presentation/modals/AssetSuggestModal';
import { noticeOnlySinks, notify, notifyFault } from '../presentation/notices/notify';
import { surfaceError } from '../presentation/errors/surfaceError';
import { ASSET_DESIGNER_VIEW } from '../presentation/designer/AssetDesignerView';
import { tr } from '../presentation/i18n/strings';
import type { PluginCommandHost } from './commandHost';

/**
 * What makes the Asset Designer (ADR-0015) reachable at all: a picker over the vault's whole
 * catalogue (`ListAssets`, vault-wide since design slice 19), and the door the create-asset
 * dialog opens through once it has made something to show.
 *
 * A sibling module to `planEditorCommands.ts` and `sampleProject.ts`, kept out of the plugin
 * shell for the same reason: that file stays registration and nothing else, and this is the
 * BEHAVIOUR behind one `addCommand` call.
 */

/**
 * Open the designer on ONE asset, through `revealAssetDesigner` — the same door
 * `ViewRoot.vue`'s create-asset flow is bound to at the composition root
 * (`renovationProjectOpenAsset`), so a picked asset and a just-created one land in exactly
 * one leaf each, never two mechanisms that could disagree about what "the same asset" means.
 *
 * Does not reject: `revealAssetDesigner` answers its own fault through `reportFault`, once
 * per activation, which is why the picker's `onChooseItem` below can `void` this rather than
 * routing it through `runDetached`.
 */
function openAssetDesigner(host: PluginCommandHost, assetId: string): Promise<void> {
	return revealAssetDesigner(
		{
			workspace: host.app.workspace,
			reportFault: (cause: unknown): void => {
				notifyFault(cause, host.root.logger, 'view.asset-designer.reveal-failed');
			},
		},
		ASSET_DESIGNER_VIEW,
		assetId,
	);
}

/**
 * Ask which Asset, then open it.
 *
 * A plain callback and a picker — never a `checkCallback` requiring some precondition, which
 * is the `open-plan-editor` defect refused in advance: a command invisible until something
 * else exists to satisfy its check is a command invisible in every vault that has not yet
 * created that thing. Available from anywhere, the same shape `PlanSuggestModal`'s caller
 * takes.
 *
 * `ListAssets` is a guarded query (SDD §66): it answers a `Result` rather than throwing, so
 * this function's only await is safe to `void` at its own call site.
 */
async function openAssetPicker(host: PluginCommandHost): Promise<void> {
	const listAssets = host.root.persistence?.requirementQueries.listAssets;
	if (listAssets === undefined) {
		notify(tr('asset.none'));
		return;
	}

	const result = await listAssets.execute();
	if (isErr(result)) {
		// Through the surface policy (SDD §66's last step), exactly as `applyBackground` does
		// for the sibling command: a translated sentence keyed by the error's code, never the
		// error's own developer-English `message`. `noticeOnlySinks` is what a plugin command
		// has — no view, no form, no indicator.
		surfaceError(result.error, { kind: 'explicit-operation' }, noticeOnlySinks);
		return;
	}

	const assets: readonly Asset[] = result.value;
	if (assets.length === 0) {
		notify(tr('asset.none'));
		return;
	}

	const picker = new AssetSuggestModal(host.app, assets, (asset) => {
		void openAssetDesigner(host, asset.id);
	});
	picker.open();
}

export function registerAssetDesignerCommands(host: PluginCommandHost): void {
	host.addCommand({
		id: 'open-asset-designer',
		name: tr('command.open-asset-designer'),
		callback: () => {
			void openAssetPicker(host);
		},
	});
}
