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
import { renovationProjectOpenAsset, renovationProjectOpenProject } from './renovationProjectOpenSeams';
import { guardAssetDuplication } from './guardedAssetLibrary';
import { VAULT_EXCEPTION_MAPPER } from './guardedServices';
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
	// The path-keyed opener, named once because BOTH doors below go through it: the repair
	// strip already holds a path, and `openAssetNote` resolves one from the index first. Two
	// spellings would be two fault doors and two coalescing maps for one gesture.
	const openNote = (path: string): Promise<'opened' | 'missing' | 'failed'> =>
		openNoteAtPath(
			{
				workspace,
				vault,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, root.logger, 'view.asset-library.open-note-failed');
				},
			},
			path,
		);
	/**
	 * AD13's pair, composed ONCE and then split across the two bundles by KIND: the duplicate is
	 * a command and the usage scope is a read, so they do not both belong in one of them. They
	 * arrive together because `guardAssetDuplication` guards them together, and that function
	 * exists because widening `guardAssetLibrary`'s ports means editing `composition-root.ts` —
	 * see its own docblock. The integrator tried that widening and backed it out: `composeGuarded`
	 * has no `PlanGeometrySidecar` in scope at all, so folding the two functions would mean
	 * CONSTRUCTING one inside a function whose own comment says it builds nothing beneath its
	 * ports. One extra call site is the cheaper of the two.
	 */
	const duplication =
		persistence === null
			? null
			: guardAssetDuplication(
					{
						assets: persistence.assets,
						assetGeometry: persistence.assetGeometry,
						events: root.eventBus,
						locks: persistence.locks,
						projects: persistence.projects,
						plans: persistence.plans,
						planGeometry: persistence.geometry,
					},
					root.logger,
					VAULT_EXCEPTION_MAPPER,
				);
	return {
		queries:
			persistence === null || duplication === null
				? unavailableAssetLibraryQueries()
				: createAssetLibraryQueries({
						...persistence.assetLibrary,
						// THREE queries this root already composed for other surfaces — the designer's
						// design read and the Plan editor's delete flow's two — REUSED rather than
						// composed a second time: two instruments answering one question is what lets
						// two surfaces disagree about one asset. The third arrived with §3.5's
						// `Delete`, whose reassign branch fills the same picker the editor's own
						// delete flow does.
						getDesign: persistence.assetDesign.get,
						listReferencing: persistence.requirementQueries.listRequirementsReferencing,
						listReassignmentTargets: persistence.requirementQueries.listReassignmentTargets,
						// AD13's usage scope — a READ, so it is here rather than in the command
						// bundle where it shipped for one commit. The branch tests `duplication` too, so
						// it narrows here without a non-null assertion: both answer one question.
						listPlansUsingAsset: duplication.listPlansUsingAsset,
					}),
		commands:
			persistence === null || duplication === null
				? unavailableAssetLibraryCommands()
				: {
						updateAsset: persistence.updateAsset,
						setAssetHeight: persistence.assetDesign.setHeight,
						deleteAsset: persistence.deleteAsset,
						// §3.1's `New asset` door — the identical guarded services
						// `renovationProjectCommandBundle` hands the Renovation project view's own
						// door, reached here rather than shared because the two bundles are
						// siblings, not one type (`AssetLibraryCommandServices`'s own docblock).
						createAsset: persistence.createAsset,
						// AD13's `Duplicate as new asset`. Its sibling read went to the query bundle
						// above; every port either takes is one this root already holds, so nothing
						// new is constructed beneath them.
						duplicateAsset: duplication.duplicateAsset,
						setAssetFootprintFromDimensions: persistence.assetDesign.setFootprintFromDimensions,
						defaultCurrency: persistence.defaultCurrency,
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
		openNote,
		// §3.5's `Open note`, resolved through the INDEX because a catalogue DTO carries no path.
		//
		// TWO causes, told apart, because the port promises they are. A null persistence answers
		// `'failed'` — the member `NoteOpenOutcome` reserves for "there was no vault to open
		// through" — since `'missing'` would tell the user their note is gone on the strength of a
		// session that never read one. A LIVE index that simply holds no note for the id answers
		// `'missing'`, which is the honest answer for an asset just deleted and is what the
		// caller re-reads its listing on. The first version of this arm folded the second cause
		// into the first under a comment that explained only the first, so the port's own docblock
		// was false and the caller's re-read was unreachable.
		openAssetNote: (assetId) => {
			if (persistence === null) return Promise.resolve('failed');
			const path = persistence.index.getPath(assetId);
			return path === undefined ? Promise.resolve('missing') : openNote(path);
		},
		openProject: (projectId) => {
			return persistence === null ? Promise.resolve('failed') : renovationProjectOpenProject(workspace, vault, persistence.index, root.logger)(projectId);
		},
		// The SAME binding the project view's `openAsset` takes, reused rather than duplicated:
		// one activation function is what stops a double click opening two designer tabs, and a
		// second spelling here would be a second answer to which leaf an asset opens in.
		openDesigner: renovationProjectOpenAsset(workspace, root.logger),
		// §3.6's status bar folder half. Read from `root.settings` directly rather than from
		// `persistence`, because the two can disagree (a null `vault` with real settings) — and
		// it costs nothing to be right about that case: the status bar this feeds is drawn only
		// once the catalogue itself read successfully, which a null `persistence` already
		// prevents through the refused `queries` above. `''` is never shown for the same reason.
		libraryFolder: root.settings?.libraryFolder ?? '',
	};
}
