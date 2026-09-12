import { planningEditorServices } from './planningEditorServices';
import { guardedReferencePlan } from './guardedReferencePlan';
import { guardedStructure } from './guardedStructure';
import { reviewNoteAction } from './reviewNoteAction';
import { structureServices } from '../application/commands/spatial/StructureCommand';
import { groupGeometryServices } from '../application/commands/spatial/GroupGeometryCommand';
import { guardedGroups } from './guardedGroups';
import { referencePlanServices } from '../application/commands/plan/ConfigurePlanReference';
import { planNorthServices } from '../application/commands/plan/SetPlanNorth';
import { guardedPlanNorth } from './guardedPlanNorth';
import type { Vault, Workspace } from 'obsidian';
import { ReversibleCalibratePlanCommand } from '../application/commands/plan/ReversibleCalibratePlan';
import { createPlanChangeSource } from '../application/events/planChangeSource';
import { createAssetCatalogueChangeSource } from '../application/events/assetCatalogueChangeSource';
import { createProjectPricesChangeSource } from '../application/events/projectPricesChangeSource';
import { createRequirementFiguresChangeSource } from '../application/events/requirementFiguresChangeSource';
import { createVaultFileChangeSource } from '../infrastructure/obsidian/vault/vaultFileChanges';
import { createThemeChangeSource } from '../infrastructure/obsidian/workspace/themeChanges';
import { unavailablePlanEditorQueries } from '../presentation/read-models/planEditorQueries';
import { unavailablePlanEditorCommands } from '../presentation/editor/planEditorCommands';
import type { PlanEditorDeps } from '../presentation/views/PlanEditorView';
import { tr } from '../presentation/i18n/strings';
import { notifyWarning } from '../presentation/notices/notify';
import { VAULT_EXCEPTION_MAPPER, guardCalibratePlan } from './guardedServices';
import { planEditorOpenNote } from './renovationProjectOpenSeams';
import type { CompositionRoot } from './composition-root';
import { editorWorkspaceNavigation } from './editorWorkspaceNavigation';
import type { EditorClipboard } from '../presentation/editor/clipboard/editorClipboard';
import type { DeviceStorage } from '../presentation/editor/PlanEditorContext';
import type { Logger } from '../application/ports/Logger';
import type { LocalStorageAdapter } from '../infrastructure/obsidian/plugin-data/continueContextStore';
import { DeviceLocalStore } from '../infrastructure/obsidian/plugin-data/deviceLocalStore';
import { editorViewPreferencesStore } from '../infrastructure/obsidian/plugin-data/editorViewPreferencesStore';

/**
 * The Plan Editor's two per-device slots, each at its OWN key and in its own shape: the side
 * panels' layout and the View menu's grid and object-snap choices. Two stores rather than one on
 * purpose — neither reads or writes the other's key.
 *
 * Here rather than in `RenovationPlannerPlugin.ts` for the reason this file's header gives: the
 * second merge of main brought one slot from each branch into a plugin both had left at exactly
 * its 400-line cap. Neither store holds state past its adapter and key, so building them per call
 * answers identically to sharing them, and a rebind loses nothing.
 */
export function planEditorDeviceSlots(adapter: LocalStorageAdapter, pluginId: string, logger: Logger) {
	return {
		panelLayout: new DeviceLocalStore(adapter, `${pluginId}:panel-layout`, logger),
		viewPreferences: editorViewPreferencesStore(adapter, `${pluginId}:editor-view`, logger),
	};
}

/**
 * Moved out of `composition-root.ts` at the merge with the Renovation Planner Home branch, for
 * the reason `assetDesignerDeps.ts` and `guardedAssetPrice.ts` already record: both branches
 * added to that file and the merged tree measured 409 counted lines against a 400 cap, which is
 * a budget already spent rather than one to buy back by reformatting.
 *
 * **Which of the four view-deps builders to move was a decision, not a coin toss.**
 * `assetDesignerDeps.ts` and `assetLibraryDeps.ts` already live in their own files, so two of
 * the four were outside before this edit; `assetDesignerDeps.ts`'s own header argues that
 * `renovationProjectDeps` should stay where it is, because its collaborators are shared with
 * the root's other wiring and an extraction would split them. That argument does not apply
 * here — every collaborator below is the editor's own — so moving this one makes the set
 * consistent rather than arbitrary, and leaves `renovationProjectDeps` as the single builder
 * the root still assembles inline, for the stated reason rather than by accident.
 *
 * Nothing about the wiring moved. This is the same function, in a file of its own.
 */
/**
 * The Plan Editor's own dependency bundle, assembled from a composed root.
 *
 * A function rather than another `CompositionRoot` field, because it needs the
 * `Workspace` — which is not part of the vault stack the persistence layer reads through —
 * and because it answers `null` for a session with no persistence at all: with settings
 * unrecovered there is no query service to hand a view, so registering one that would
 * draw an empty pane is worse than not being able to open it.
 */
export function planEditorDeps(
	root: CompositionRoot,
	workspace: Workspace,
	vault: Vault,
	clipboard: EditorClipboard,
	panelLayout: DeviceStorage,
): PlanEditorDeps {
	const persistence = root.persistence;
	return {
		navigation: editorWorkspaceNavigation(workspace, root.logger),
		clipboard,
		panelLayout,
		// TOTAL rather than nullable, and that is the point: with settings unrecovered there
		// is no query service to hand over, so the view is handed one that REFUSES and shows
		// the same failed state it shows for any unreadable plan. The alternatives were a
		// nullable dependency every caller has to branch on, or not registering the view at
		// all — which would leave a restored Plan Editor leaf pointing at a view type
		// Obsidian does not know.
		queries: persistence?.planEditorQueries ?? unavailablePlanEditorQueries(),
		commands: persistence
			? {
					...planningEditorServices(root, vault, workspace),
					groups: guardedGroups(groupGeometryServices(persistence.geometry, persistence.zones, root.eventBus), root.logger),
					reviewNote: reviewNoteAction(vault, workspace, persistence.index, root.logger),
										structure: guardedStructure(structureServices(persistence.geometry, root.eventBus), root.logger),
					createZone: persistence.createZone,
					createPlan: persistence.createPlan,
					updatePlanDetails: persistence.updatePlanDetails,
					referencePlan: guardedReferencePlan(referencePlanServices(persistence.plans, persistence.geometry, root.eventBus, persistence.files), root.logger),
					planNorth: guardedPlanNorth(planNorthServices(persistence.plans, root.eventBus), root.logger),
					moveObject: persistence.moveZone,
					deleteZone: persistence.deleteZone,
					zones: persistence.zones,
					// The real bus, so the reversible adapters constructed from this bundle can
					// finally publish what their undo and redo write.
					events: root.eventBus,
					zoneInspector: persistence.zoneInspector,
					requirementEdits: {
						// The GUARDED services, not the composed classes: the adapters take
						// structural doors (`Command`, `…Door`) precisely so a wrapper can
						// stand where the class used to, which is what puts these three
						// inside the Error Boundary instead of beside it.
						assignAsset: persistence.assignAsset,
						setQuantityOverride: persistence.setRequirementQuantityOverride,
						setCostOverride: persistence.setRequirementCostOverride,
						requirements: persistence.requirements,
						assets: persistence.assets,
						locks: persistence.locks,
					},
					// The LEAF's logger, beside the bundles rather than inside one of them:
					// a failed compensation inside a reversible adapter's undo writes to it,
					// and so does `notifyFault` at the two raw-port fault doors in
					// `runtime.ts` — and the second of those is not about requirement edits.
					logger: root.logger,
					// A new command per call — see `CalibratePlanTransaction` — and GUARDED
					// per call, because the factory is the only door this one has: it never
					// passes through `PersistenceServices`, so `composeGuarded` cannot reach
					// it, and the tool's dispatch path has no `.catch` of its own.
					calibratePlan: () =>
						guardCalibratePlan(
							new ReversibleCalibratePlanCommand(persistence.plans, persistence.geometry, root.eventBus),
							root.logger,
							VAULT_EXCEPTION_MAPPER,
						),
				}
			: unavailablePlanEditorCommands(),
		// §2.6: the SAME `openProjectNote` the project view uses — a plan's note needs no
		// second opener, since that function resolves any entity id through the index. With
		// settings unrecovered there is no index to resolve against, so the refusal shape is
		// the same one every other `unavailable*` bundle uses.
		openNote: persistence
			? planEditorOpenNote(workspace, vault, persistence.index, root.logger)
			: () => {
					notifyWarning(tr('settings.unrecovered'));
					return Promise.resolve('failed' as const);
				},
		vault,
		onThemeChange: createThemeChangeSource(workspace),
		onPlanChanged: createPlanChangeSource(root.eventBus),
		onCatalogueChanged: createAssetCatalogueChangeSource(root.eventBus),
		onProjectPricesChanged: createProjectPricesChangeSource(root.eventBus),
		onRequirementFiguresChanged: createRequirementFiguresChangeSource(root.eventBus),
		onVaultFileChanged: createVaultFileChangeSource(vault),
	};
}
