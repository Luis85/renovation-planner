import type { App } from 'obsidian';
import { ObsidianBackgroundPicker } from './assetBackgroundPicker';
import { createAssetDesignChangeSource } from '../application/events/assetDesignChangeSource';
import { createThemeChangeSource } from '../infrastructure/obsidian/workspace/themeChanges';
import { createVaultFileChangeSource } from '../infrastructure/obsidian/vault/vaultFileChanges';
import type { Logger } from '../application/ports/Logger';
import { editorViewPreferencesStore } from '../infrastructure/obsidian/plugin-data/editorViewPreferencesStore';
import type { LocalStorageAdapter } from '../infrastructure/obsidian/plugin-data/continueContextStore';
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
import type { ContinueContext } from '../application/continueContext';
import { assetDesignerUsePlan } from './renovationProjectOpenSeams';
import { guardAssetUsage } from './guardedAssetLibrary';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';

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
	options: {
		indexScanCompleted: () => boolean;
		openLibrary: () => void;
		/**
		 * Plugin-local, per-device state over `App.loadLocalStorage` — carried through exactly as
		 * `renovationProjectDeps` carries it, and for the same reason: the store is memoised on
		 * the plugin instance (its own coalescing depends on being one instance), so this module
		 * may not build a second one. REQUIRED rather than defaulted, the same reason that
		 * function states: a composition that forgot it would still compile and silently stop
		 * recording where the user was.
		 */
		rememberContinue: (context: ContinueContext) => void;
	},
): AssetDesignerDeps {
	const persistence = root.persistence;
	return {
		openLibrary: options.openLibrary,
		// AD13's forward door. Composed HERE rather than taken in `options` on two counts. The
		// first is that everything it needs is already in this function's arguments — the index
		// off `root.persistence`, the logger off `root` — so passing it in meant the caller
		// reaching for the same two members one level up. The second is a line budget:
		// `RenovationPlannerPlugin.ts` sits at its 400-line cap, the five-line `options` literal
		// this replaced put it over, and the fix has to be an extraction rather than a
		// suppression.
		//
		// Unconditional on `persistence`, unlike `queries` and `commands` below: an index that is
		// `undefined` is the unrecovered-settings session, which `entriesOfType` answers for with
		// the same "no plans" notice an empty vault gets. A refusing seam would draw nothing.
		usePlan: assetDesignerUsePlan(app, persistence?.index, root.logger, options.rememberContinue),
		picker: new ObsidianBackgroundPicker(app),
		// Obsidian's real `Vault`, passed straight in: `BackgroundVault` is a `Pick` of it, so
		// there is nothing to adapt and nothing that can drift from the API.
		vault: app.vault,
		// The second argument is ruling AD13-R1's usage scope, composed through `guardAssetUsage` —
		// the SAME function `guardAssetDuplication` calls for the library's own scope panel, which
		// is the whole of part 3 of that ruling: one question, one instrument, two surfaces.
		// Calling `guardAssetDuplication` from here instead would build a `DuplicateAssetCommand`
		// nothing in the designer dispatches.
		//
		// Every port it needs is one this root already holds, and nothing is constructed beneath
		// them. `VAULT_EXCEPTION_MAPPER` is the one instance every guarded group shares, reached
		// here the way `assetLibraryDeps` reaches it.
		queries:
			persistence === null
				? unavailableAssetDesignerQueries()
				: createAssetDesignerQueries(
						persistence.assetDesign,
						guardAssetUsage(
							{
								projects: persistence.projects,
								plans: persistence.plans,
								planGeometry: persistence.geometry,
							},
							root.logger,
							VAULT_EXCEPTION_MAPPER,
						),
					),
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

/**
 * The asset designer's per-device slot: the View menu's choices, under `designer-view` rather than the Plan Editor's
 * `editor-view`. Built per call, for `planEditorDeviceSlots`' reason: it holds nothing past its adapter and key.
 */
export function assetDesignerDeviceSlots(adapter: LocalStorageAdapter, pluginId: string, logger: Logger) {
	return { viewPreferences: editorViewPreferencesStore(adapter, `${pluginId}:designer-view`, logger) };
}
