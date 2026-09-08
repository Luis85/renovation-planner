import type { Workspace } from 'obsidian';
import type { Logger } from '../application/ports/Logger';
import type { EditorNavigation } from '../presentation/editor/PlanEditorContext';
import { navigateToProject } from '../infrastructure/obsidian/workspace/navigateToProject';
import { RENOVATION_PROJECT_VIEW } from '../presentation/views/RenovationProjectView';
import { renovationProjectOpenAssetLibrary } from './renovationProjectOpenSeams';
import { notifyFault } from '../presentation/notices/notify';

/** Reuse the host navigation gates; never replace the originating editor's view state. */
export function editorWorkspaceNavigation(workspace: Workspace, logger: Logger): EditorNavigation {
	return {
		project: projectId => navigateToProject({ workspace, reportFault: cause => {
			notifyFault(cause, logger, 'plan-editor.open-project-failed');
		} }, RENOVATION_PROJECT_VIEW, projectId),
		downstream: (projectId, route) => navigateToProject({ workspace, reportFault: cause => { notifyFault(cause, logger, 'plan-editor.open-project-failed'); } }, RENOVATION_PROJECT_VIEW, projectId, undefined, route),
		library: renovationProjectOpenAssetLibrary(workspace, logger),
	};
}
