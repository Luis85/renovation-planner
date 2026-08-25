import { inject, type InjectionKey } from 'vue';
import type { PlanEditorQueryServices } from '../read-models/planEditorQueries';
import type { PlanEditorCommandServices } from './planEditorCommands';
import type { BackgroundVault } from './layers/background/BackgroundRenderModel';

/**
 * Everything the Plan Editor's Vue tree needs from outside itself, provided ONCE by
 * `PlanEditorView` on the app instance it created.
 *
 * Named `PlanEditorContext` and not `EditorContext`: that word belongs to
 * `tools/editor-context.ts` (design slice 6, SDD §58), the facade
 * `EditorTool.activate(context)` receives — a spec-bound name this one has no claim on.
 * Both types existed under the one name for two slices, which cost a "read carefully"
 * paragraph in each file, an aliased import at their only shared consumer, and a genuine
 * duplicate-export finding from `npm run analyze`. This has nothing to do with tools:
 * it is what the LEAF is, provided once by `PlanEditorView` on the app instance it created.
 *
 * One injection key rather than a prop threaded through five components, because every
 * member here is a property of the LEAF — which plan it shows, which vault it reads,
 * whose theme it follows — and a prop chain would make every intermediate component
 * declare things it does not use. It is `app.provide`, not a module-level singleton, which
 * is what keeps two Plan Editor leaves genuinely independent (ADR-004).
 */
export interface PlanEditorContext {
	/** The Plan this leaf shows. Carried in Obsidian's per-leaf view state, not in the type. */
	readonly planId: string;
	readonly queries: PlanEditorQueryServices;
	/**
	 * The write side (design slice 8): the plain commands the editor's reversible
	 * adapters wrap, the repository port their restore halves read and write through,
	 * and the Inspector query. See `planEditorCommands.ts`.
	 */
	readonly commands: PlanEditorCommandServices;
	readonly vault: BackgroundVault;
	/**
	 * Obsidian's `css-change`, as a subscription that hands back its own unsubscribe.
	 *
	 * A callback rather than the `Workspace` itself: the components' only interest is "the
	 * theme changed, re-resolve", and handing them a workspace would let any of them reach
	 * for the rest of it. The view owns registering and disposing the real event.
	 */
	onThemeChange(listener: () => void): () => void;
	/**
	 * "This Plan changed on disk — re-read it." Fired for THIS plan only; the view filters,
	 * so a second Plan Editor leaf does not re-hydrate because the first one's plan moved.
	 *
	 * This is what makes `SetPlanBackgroundCommand` visible on the canvas without the
	 * command knowing a canvas exists: it publishes `PlanBackgroundChanged`, the view
	 * translates that into this callback, and the root re-runs the SAME hydrate routine
	 * that ran at open. Slice 8's "re-hydrate after every committed command" is this seam,
	 * widened to more event types — not a second mechanism beside it.
	 */
	onPlanChanged(listener: () => void): () => void;
}

export const PLAN_EDITOR_CONTEXT: InjectionKey<PlanEditorContext> = Symbol('renovation-planner:editor-context');

/**
 * Throws rather than returning `undefined` when the context is absent, because there is no
 * sensible degraded behaviour: a canvas with no plan id and no vault would mount, draw
 * nothing, and look like an empty plan. Failing at mount points at the composition
 * mistake instead.
 */
export function usePlanEditorContext(): PlanEditorContext {
	const context = inject(PLAN_EDITOR_CONTEXT);
	if (context === undefined) {
		throw new Error('The plan editor was mounted without a PlanEditorContext.');
	}
	return context;
}
