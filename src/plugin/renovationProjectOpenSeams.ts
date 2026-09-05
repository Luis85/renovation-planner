import type { Vault, Workspace } from 'obsidian';
import type { Logger } from '../application/ports/Logger';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import { openProjectNote, type ProjectNoteOpenOutcome } from '../infrastructure/obsidian/workspace/openNote';
import { revealPlanEditor } from '../infrastructure/obsidian/workspace/revealPlanEditor';
import { revealAssetDesigner } from '../infrastructure/obsidian/workspace/revealAssetDesigner';
import { revealView } from '../infrastructure/obsidian/workspace/revealView';
import { PLAN_EDITOR_VIEW } from '../presentation/views/PlanEditorView';
import { ASSET_DESIGNER_VIEW } from '../presentation/designer/AssetDesignerView';
import { ASSET_LIBRARY_VIEW } from '../presentation/library/AssetLibraryView';
import { notifyFault } from '../presentation/notices/notify';

/**
 * `RenovationProjectDeps.openPlan`, bound to the real `revealPlanEditor` — pulled out of
 * `renovationProjectDeps` for line budget alone: `composition-root.ts` sat at its 400-line
 * cap, and CLAUDE.md's own account of `inspector-wiring.ts` is why the answer is an
 * extraction rather than a second collapsed literal. Same seam, same reasoning, just no
 * longer inline.
 */
export function renovationProjectOpenPlan(workspace: Workspace, logger: Logger): (planId: string) => Promise<void> {
	return (planId) =>
		revealPlanEditor(
			{
				workspace,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'view.plan-editor.reveal-failed');
				},
			},
			PLAN_EDITOR_VIEW,
			planId,
		);
}

/**
 * `RenovationProjectDeps.openAsset`, bound to the real `revealAssetDesigner` — the same
 * line-budget extraction as `renovationProjectOpenPlan` above, and the same door Task B9's
 * `open-asset-designer` picker opens through: a just-created asset and a picked one both land
 * in exactly one leaf, because both callers share this one binding rather than each deciding
 * activation for itself.
 */
export function renovationProjectOpenAsset(workspace: Workspace, logger: Logger): (assetId: string) => Promise<void> {
	return (assetId) =>
		revealAssetDesigner(
			{
				workspace,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'view.asset-designer.reveal-failed');
				},
			},
			ASSET_DESIGNER_VIEW,
			assetId,
		);
}

/**
 * `RenovationProjectDeps.openAssetLibrary`, bound to the real `revealView` — the same
 * line-budget extraction as its two siblings above, and `void` rather than `Promise<void>` for
 * the reason its own docblock gives: a SINGLETON with no id to resolve takes the plain
 * `revealView` every other singleton reveal in this plugin already uses
 * (`RenovationPlannerPlugin.openProject`, and this view's own command into itself), which
 * answers every fault through `reportFault` and cannot reject.
 */
export function renovationProjectOpenAssetLibrary(workspace: Workspace, logger: Logger): () => void {
	return () => {
		void revealView(
			{
				workspace,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'view.asset-library.reveal-failed');
				},
			},
			ASSET_LIBRARY_VIEW,
		);
	};
}

/**
 * `PlanEditorDeps.openNote`: the SAME `openProjectNote` the project view uses, because that
 * function resolves any entity id through the index — a plan's note needs no second opener.
 * The fault mapping is this door's own event name (`plan-editor.open-note-failed`), so a log
 * line says which of the two callers of `openProjectNote` faulted; the coalescing
 * (`openingByPath`, inside `openProjectNote` itself) is shared with the project view's own
 * binding, which is correct — the two ids never collide, since a plan's note and a project's
 * note are never the same file.
 */
export function planEditorOpenNote(
	workspace: Workspace,
	vault: Vault,
	index: ProjectIndex,
	logger: Logger,
): (entityId: string) => Promise<ProjectNoteOpenOutcome> {
	return (entityId) =>
		openProjectNote(
			{
				workspace,
				vault,
				index,
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'plan-editor.open-note-failed');
				},
			},
			entityId,
		);
}

/**
 * `RenovationProjectDeps.openProject`, bound to the real `openProjectNote` — the same
 * line-budget extraction as `renovationProjectOpenPlan` above, and nothing about the
 * behaviour moved: the fault mapping (`view.project.open-failed`) and the coalescing this
 * wraps (`openingByPath`, inside `openProjectNote` itself) are unchanged.
 */
export function renovationProjectOpenProject(
	workspace: Workspace,
	vault: Vault,
	index: ProjectIndex,
	logger: Logger,
): (projectId: string) => Promise<ProjectNoteOpenOutcome> {
	return (projectId) =>
		openProjectNote(
			{
				workspace,
				vault,
				index,
				// The fault answers `'failed'` down there and never `'missing'`: the id DID
				// resolve and the open faulted, so the list behind the row is not stale and a
				// vault-wide re-read would answer a question nobody asked. This notice is what
				// the user acts on.
				reportFault: (cause: unknown): void => {
					notifyFault(cause, logger, 'view.project.open-failed');
				},
			},
			projectId,
		);
}
