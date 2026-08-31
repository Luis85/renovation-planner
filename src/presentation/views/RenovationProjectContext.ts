import { inject, type InjectionKey } from 'vue';
import type { RenovationProjectQueryServices } from '../read-models/renovationProjectQueries';
import type { RenovationProjectCommandServices } from './renovationProjectCommands';

/**
 * What a project row's click did, as far as the VIEW needs to know.
 *
 * `'missing'` is the only member the view branches on: the row points at a project the vault
 * no longer holds, so the list it was drawn from is stale and gets re-read. `'failed'` covers
 * both arms that did not open a note for some other reason — an I/O fault, which the fault
 * door the composition root hands `openProjectNote` has already mapped into a notice, and a
 * session with unrecovered settings, where there is no index to resolve through and no list to
 * refresh. Neither is a stale row, so neither buys a vault-wide re-read.
 *
 * Declared here rather than imported from `openProjectNote`'s own union, which is where all
 * three members come from — the third since the round that moved fault reporting inside the
 * coalescing: `presentation/` may not import `infrastructure/`, and the composition root is
 * the layer that may see both.
 */
export type ProjectOpenOutcome = 'opened' | 'missing' | 'failed';

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
	 *
	 * It ANSWERS rather than resolving to nothing, so a row pointing at a deleted note can be
	 * cleared by the click that found it stale — see `ProjectOpenOutcome`.
	 */
	readonly openProject: (projectId: string) => Promise<ProjectOpenOutcome>;
	/**
	 * "The set of projects may have changed — re-read it." Carries no payload, because the one
	 * event behind it (`ProjectIndexRebuilt`) carries none: a rebuild says nothing about WHICH
	 * projects moved, so the only honest response is to run the same read again.
	 *
	 * **This is not politeness, it is the restored-leaf case.** The index scan runs from
	 * `onLayoutReady` and Obsidian restores its leaves BEFORE that, so a Renovation Project
	 * pane reopened with the app hydrates against an empty index, gets a legitimate empty list
	 * back, and draws "no projects yet" over a populated vault — with no later read to correct
	 * it, since this view's other two hydrations are its own mount and its own create.
	 * `projectIndex.events.ts` documents the hazard and `PlanEditorContext.onPlanChanged`
	 * closes it for the other surface; this is the same closure for this one.
	 *
	 * Returns its own disposer, and the view registers that as an unmount hook: Obsidian
	 * REUSES a view, so a subscription outliving its Vue app would hydrate a store nothing
	 * renders and stack a second listener on every reopen.
	 */
	readonly onProjectsChanged: (listener: () => void) => () => void;
	/**
	 * Which state this mount draws: `null` is the LIST, a string is that project's detail
	 * state. Fixed per mount, never reactive — the view REMOUNTS per navigation
	 * (`RenovationProjectView.sync`), so the tree is built from this value and the two cannot
	 * disagree. A provided `Ref` would be the first reactive member any view context here
	 * carries and a second way a Vue tree in this plugin learns its subject changed.
	 */
	readonly projectId: string | null;
	/**
	 * Go to a project, or back to the list with `null`. The ONE writer of that state.
	 *
	 * It is a `setViewState` round trip rather than a store mutation, and that round trip is
	 * what buys the pane's own back and forward arrows: `RenovationProjectView.setState` sets
	 * `ViewStateResult.history`, so each navigation is an entry in Obsidian's own leaf
	 * navigation history. A `showList()` method on the view would be a second decider.
	 */
	readonly navigate: (projectId: string | null) => void;
	/**
	 * Open a plan in the Plan Editor — bound to `revealPlanEditor` at the root, the same shape
	 * and for the same reason as `openProject`: `presentation/` may not reach Obsidian's
	 * workspace, and a `PlanSummaryDto` carries no path.
	 */
	readonly openPlan: (planId: string) => Promise<void>;
	/**
	 * "Some plan of THIS project changed — re-read it." The third change source
	 * (`projectPlansChangeSource`), filtered on the owning project, which `PlanCreated`'s
	 * payload carries.
	 *
	 * Returns its own disposer, registered as an unmount hook for the reason
	 * `onProjectsChanged` states: Obsidian REUSES a view, so a subscription outliving its Vue
	 * app stacks another on every reopen.
	 */
	readonly onPlansChanged: (projectId: string, listener: () => void) => () => void;
	/**
	 * Has the initial index scan RUN — zero entries included.
	 *
	 * What makes a `getProject` answering `ok(null)` authoritative rather than a race against
	 * layout-ready. Obsidian restores its leaves BEFORE `onLayoutReady` and the scan runs from
	 * it, so a restored detail state asks an empty index and gets a legitimate `ok(null)`;
	 * acting on that would set `{ projectId: '' }` and destroy the state it is about.
	 *
	 * **A predicate rather than a subscription, and not a reuse of `onProjectsChanged`.** That
	 * callback collapses three events into one payload-less signal by design, so a listener
	 * cannot tell a completed rebuild from a `ProjectCreated` — treating any callback as proof
	 * of a scan would let a create in another leaf authorise the navigation. The store needs
	 * the answer AT HYDRATE TIME, and the re-hydrate already arrives through
	 * `onProjectsChanged`; a second subscription would be a second thing to dispose for a fact
	 * that never goes back to false.
	 *
	 * **The question is whether the scan RAN, never whether it found anything.** An earlier
	 * draft asked "has the index been populated", which hangs a restored pane forever in a
	 * vault whose last project note was deleted while Obsidian was closed.
	 */
	readonly indexScanCompleted: () => boolean;
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
