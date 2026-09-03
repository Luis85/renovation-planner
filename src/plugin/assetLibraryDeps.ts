import type { Vault, Workspace } from 'obsidian';
import { createAssetLibraryChangeSource } from '../application/events/assetLibraryChangeSource';
import { openNoteAtPath } from '../infrastructure/obsidian/workspace/openNote';
import { notifyFault } from '../presentation/notices/notify';
import {
	createAssetLibraryQueries,
	unavailableAssetLibraryQueries,
} from '../presentation/read-models/assetLibraryQueries';
import {
	unavailableAssetLibraryCommands,
	type AssetLibraryDeps,
} from '../presentation/library/AssetLibraryDeps';
import { renovationProjectOpenAsset } from './renovationProjectOpenSeams';
import type { CompositionRoot } from './composition-root';

/**
 * The Asset library's own dependency bundle, assembled from a composed root.
 *
 * Its OWN module rather than a fourth function in `composition-root.ts`, for the reason
 * `assetDesignerDeps.ts` and `renovationProjectCommandBundle.ts` already record: that file sat
 * at 386 counted lines against a 400 cap when this arrived, and a budget bought back by
 * reformatting is a budget that has already been spent. This is a whole VIEW-DEPS builder
 * rather than whatever happened to fit, which is the seam those two already draw.
 *
 * **It is spelled ONCE and used by both the `registerView` factory and `rebindOpenViews`**
 * (§2's placement table), so a rebind cannot hand the view something its factory would not
 * have built. That matters more here than on any other surface: §83's library-folder migration
 * MOVES every catalogue note and then swaps the root, so an un-rebound library goes on
 * resolving asset notes at the folder they have just left.
 *
 * TOTAL rather than nullable, for `planEditorDeps`'s reason: with settings unrecovered there
 * is no query service to hand over, so the view is handed one that REFUSES and draws §4's
 * *Failed, unrecoverable* row. Not registering the view at all would leave a restored library
 * leaf pointing at a view type Obsidian does not know.
 */
export function assetLibraryDeps(
	root: CompositionRoot,
	workspace: Workspace,
	vault: Vault,
	options: { indexScanCompleted: () => boolean },
): AssetLibraryDeps {
	const persistence = root.persistence;
	return {
		queries:
			persistence === null
				? unavailableAssetLibraryQueries()
				: createAssetLibraryQueries({
						...persistence.assetLibrary,
						// The designer's own guarded query and the delete flow's own, REUSED rather
						// than composed a second time: two instruments answering one question is
						// what lets two surfaces disagree about one asset.
						getDesign: persistence.assetDesign.get,
						listReferencing: persistence.requirementQueries.listRequirementsReferencing,
					}),
		commands:
			persistence === null
				? unavailableAssetLibraryCommands()
				: {
						updateAsset: persistence.updateAsset,
						setAssetHeight: persistence.assetDesign.setHeight,
						deleteAsset: persistence.deleteAsset,
					},
		logger: root.logger,
		// Wired from the bus UNCONDITIONALLY, persistence or not, for the reason
		// `renovationProjectDeps.onPlansChanged` states: the bus is the root's own and exists
		// either way, and a refusing bundle re-reading simply refuses again.
		onLibraryChanged: createAssetLibraryChangeSource(root.eventBus),
		indexScanCompleted: options.indexScanCompleted,
		// BY PATH, which is the only addressing mode §5.1a's repair strip has: two of its three
		// unreadable sources carry no usable id at all. The fault door is composed HERE for
		// `renovationProjectOpenProject`'s reason — `infrastructure/` may not import
		// `presentation/notices/notify`, and `plugin/` is the one layer that may reach both —
		// and it is CALLED down there, because that is where the coalescing is.
		openNote: (path) =>
			openNoteAtPath(
				{
					workspace,
					vault,
					reportFault: (cause: unknown): void => {
						notifyFault(cause, root.logger, 'view.asset-library.open-note-failed');
					},
				},
				path,
			),
		// The SAME binding the project view's `openAsset` takes, reused rather than duplicated:
		// one activation function is what stops a double click opening two designer tabs, and a
		// second spelling here would be a second answer to which leaf an asset opens in.
		openDesigner: renovationProjectOpenAsset(workspace, root.logger),
		// Obsidian's real `Vault`, passed straight in: `BackgroundVault` is a `Pick` of it, so
		// there is nothing to adapt and nothing that can drift from the API.
		vault,
	};
}
