import type { Vault, Workspace } from 'obsidian';
import type { Logger } from '../application/ports/Logger';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import { openProjectNote, type ProjectNoteOpenOutcome } from '../infrastructure/obsidian/workspace/openNote';
import { revealPlanEditor } from '../infrastructure/obsidian/workspace/revealPlanEditor';
import { revealAssetDesigner } from '../infrastructure/obsidian/workspace/revealAssetDesigner';
import { PLAN_EDITOR_VIEW } from '../presentation/views/PlanEditorView';
import { ASSET_DESIGNER_VIEW } from '../presentation/designer/AssetDesignerView';
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
