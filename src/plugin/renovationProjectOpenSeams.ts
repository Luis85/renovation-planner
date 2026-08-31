import type { Vault, Workspace } from 'obsidian';
import type { Logger } from '../application/ports/Logger';
import type { ProjectIndex } from '../application/ports/ProjectIndex';
import { openProjectNote, type ProjectNoteOpenOutcome } from '../infrastructure/obsidian/workspace/openNote';
import { revealPlanEditor } from '../infrastructure/obsidian/workspace/revealPlanEditor';
import { PLAN_EDITOR_VIEW } from '../presentation/views/PlanEditorView';
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
