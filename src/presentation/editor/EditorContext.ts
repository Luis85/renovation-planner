import { inject, type InjectionKey } from 'vue';
import type { PlanEditorQueryServices } from '../read-models/planEditorQueries';
import type { BackgroundVault } from './layers/background/BackgroundRenderModel';

/**
 * Everything the Plan Editor's Vue tree needs from outside itself, provided ONCE by
 * `PlanEditorView` on the app instance it created.
 *
 * **Naming collision, read carefully**: `src/presentation/editor/tools/editor-context.ts`
 * (design slice 6, SDD §58) declares a DIFFERENT type also called `EditorContext` — the
 * facade `EditorTool.activate(context)` receives, carrying `viewport`, `selection`,
 * `snapService`, `commandDispatcher`, `writeLedger`, `renderState` and `activePlan`. It has
 * nothing to do with Vue's dependency injection and is never provided or injected. That
 * file carries the full account of why both keep the name; import the one you mean from its
 * own module.
 *
 * One injection key rather than a prop threaded through five components, because every
 * member here is a property of the LEAF — which plan it shows, which vault it reads,
 * whose theme it follows — and a prop chain would make every intermediate component
 * declare things it does not use. It is `app.provide`, not a module-level singleton, which
 * is what keeps two Plan Editor leaves genuinely independent (ADR-004).
 */
export interface EditorContext {
	/** The Plan this leaf shows. Carried in Obsidian's per-leaf view state, not in the type. */
	readonly planId: string;
	readonly queries: PlanEditorQueryServices;
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

export const EDITOR_CONTEXT: InjectionKey<EditorContext> = Symbol('renovation-planner:editor-context');

/**
 * Throws rather than returning `undefined` when the context is absent, because there is no
 * sensible degraded behaviour: a canvas with no plan id and no vault would mount, draw
 * nothing, and look like an empty plan. Failing at mount points at the composition
 * mistake instead.
 */
export function useEditorContext(): EditorContext {
	const context = inject(EDITOR_CONTEXT);
	if (context === undefined) {
		throw new Error('The plan editor was mounted without an EditorContext.');
	}
	return context;
}
