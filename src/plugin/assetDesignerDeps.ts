import type { App } from 'obsidian';
import { ObsidianBackgroundPicker } from './assetBackgroundPicker';
import { createAssetDesignChangeSource } from '../application/events/assetDesignChangeSource';
import { createThemeChangeSource } from '../infrastructure/obsidian/workspace/themeChanges';
import { createVaultFileChangeSource } from '../infrastructure/obsidian/vault/vaultFileChanges';
import {
	createAssetDesignerQueries,
	unavailableAssetDesignerQueries,
} from '../presentation/read-models/assetDesignerQueries';
import {
	createAssetDesignerCommands,
	unavailableAssetDesignerCommands,
} from '../presentation/designer/designerCommands';
import type { AssetDesignerDeps } from '../presentation/designer/AssetDesignerContext';
import type { CompositionRoot } from './composition-root';

/**
 * Moved out of `composition-root.ts` at the merge of the per-project price override and the
 * asset designer increments, alongside `guardedAssetPrice.ts` and for the same reason: both
 * branches added to that file and the merged tree measured 428 counted lines against a 400
 * cap, which is a budget already spent rather than one to buy back by reformatting.
 *
 * This is a whole VIEW-DEPS builder rather than whatever happened to fit — the seam
 * `renovationProjectOpenSeams.ts` and `renovationProjectCommandBundle.ts` already draw out of
 * the same function. Nothing about the wiring moved.
 *
 * **This paragraph said `planEditorDeps` and `renovationProjectDeps` "deliberately stay where
 * they are", and half of that stopped being true at the next merge.** `planEditorDeps` moved to
 * `planEditorDeps.ts` when `composition-root.ts` crossed its cap again, on the same argument
 * this file was extracted on — every collaborator is the editor's own, so the extraction splits
 * nothing. What survives is the claim about `renovationProjectDeps`, which is the one builder
 * the root still assembles inline, because its collaborators ARE shared with the root's other
 * wiring.
 */
/**
 * The asset designer's own dependency bundle (design slice B3, ADR-0015; the picker since
 * Task B7).
 *
 * It takes an `App` and no `Workspace`, which is what still separates it from its two siblings
 * and is a fact about the surface rather than an omission: the designer navigates nowhere and
 * follows no theme. It DOES read raw files — Obsidian's own file suggester to pick a spec
 * sheet, and the vault behind it to draw the sheet that was picked — and an `App` is the
 * narrowest thing that gets it both, which is why the signature did not have to grow a
 * parameter when the background layer stopped being empty.
 *
 * **The picker is bound UNCONDITIONALLY, independent of `persistence`.** Picking a file needs
 * no vault write of this plugin's own, and the picker's own result reaches a command that
 * refuses through the ordinary refused-write path when there is nothing to dispatch it to —
 * the same reasoning `onDesignChanged` above already states for wiring off the bus regardless
 * of session state.
 *
 * TOTAL rather than nullable, for `planEditorDeps`'s reason: with settings unrecovered there is
 * no query service to hand over, so the view is handed one that REFUSES and draws the same
 * failure state it draws for any unreadable asset. Not registering the view at all would leave a
 * restored designer leaf pointing at a view type Obsidian does not know.
 */
export function assetDesignerDeps(
	root: CompositionRoot,
	app: App,
	options: { indexScanCompleted: () => boolean },
): AssetDesignerDeps {
	const persistence = root.persistence;
	return {
		picker: new ObsidianBackgroundPicker(app),
		// Obsidian's real `Vault`, passed straight in: `BackgroundVault` is a `Pick` of it, so
		// there is nothing to adapt and nothing that can drift from the API.
		vault: app.vault,
		queries:
			persistence === null
				? unavailableAssetDesignerQueries()
				: createAssetDesignerQueries(persistence.assetDesign),
		// The write side (design slice B5), composed from the GUARDED design bundle plus the
		// three ports its reversible adapters restore through. Presentation holding a port is
		// the bargain `PlanEditorCommandServices.zones` already makes and for the same reason:
		// an inverse writes a whole snapshot back, which is a repository call and not a command.
		commands:
			persistence === null
				? unavailableAssetDesignerCommands()
				: createAssetDesignerCommands(
						{
							sidecar: persistence.assetGeometry,
							assets: persistence.assets,
							events: root.eventBus,
						},
						persistence.assetDesign,
					),
		logger: root.logger,
		// Wired from the bus UNCONDITIONALLY, persistence or not, for the reason
		// `renovationProjectDeps.onPlansChanged` states: the bus is the root's own and exists
		// either way, and a refusal bundle re-reading simply refuses again.
		onDesignChanged: createAssetDesignChangeSource(root.eventBus),
		// The SAME `css-change` source the Plan Editor takes, from the same workspace. Two
		// surfaces resolve an Obsidian palette into canvas colours and both need telling when
		// it moves; a second mechanism here would be a second answer to one question.
		onThemeChange: createThemeChangeSource(app.workspace),
		onVaultFileChanged: createVaultFileChangeSource(app.vault),
		indexScanCompleted: options.indexScanCompleted,
	};
}
