import { inject, type InjectionKey } from 'vue';
import type { RenovationProjectQueryServices } from '../read-models/renovationProjectQueries';
import type { RenovationProjectCommandServices } from './renovationProjectCommands';

/**
 * Everything the Renovation Project view's Vue tree needs from outside itself, provided
 * ONCE by `RenovationProjectView` on the app instance it created.
 *
 * Mirrors `PlanEditorContext`: one injection key rather than a prop threaded through the
 * tree, because `queries` is a property of the LEAF, and `app.provide` (not a module-level
 * singleton) is what keeps two leaves of this view genuinely independent — though today
 * this view is a singleton, so that independence has no second leaf to matter for yet.
 *
 * Slice 1 reserved this seam in writing: "Query-service access is constructor-injected …
 * exactly like `RenovationProjectView` would be once it has data needs." This is that data
 * need, extending the seam by a field rather than relocating it.
 */
export interface RenovationProjectDeps {
	readonly queries: RenovationProjectQueryServices;
	/** Design slice 16's write side — guarded at the root, refusing when settings are unrecovered. */
	readonly commands: RenovationProjectCommandServices;
	/**
	 * Opens a project's own note. It lives here rather than being derived in the view because
	 * `presentation/` may not reach Obsidian's vault and a `ProjectSummaryDto` carries no
	 * path — only `id`, `name` and `status`. The composition root knows both the workspace and
	 * the index, which is the same reason `revealView` takes a view type as a string.
	 */
	readonly openProject: (projectId: string) => Promise<void>;
}

export const RENOVATION_PROJECT_CONTEXT: InjectionKey<RenovationProjectDeps> = Symbol(
	'renovation-planner:renovation-project-context',
);

/**
 * Throws rather than returning `undefined` when the context is absent, because there is no
 * sensible degraded behaviour: a view with no query services would mount, draw nothing (or
 * worse, a plausible-looking empty state built on a `null` it should never have seen), and
 * look like an empty project list rather than a composition mistake. Failing at mount points
 * at the mistake instead — the same reasoning `usePlanEditorContext` states.
 */
export function useRenovationProjectContext(): RenovationProjectDeps {
	const context = inject(RENOVATION_PROJECT_CONTEXT);
	if (context === undefined) {
		throw new Error('The renovation project view was mounted without a RenovationProjectContext.');
	}
	return context;
}
