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
	/**
	 * "The vault's asset catalogue changed — re-read it." Unfiltered, because an Asset
	 * belongs to no project since design slice 19 and to no plan ever: there is no id to
	 * filter on and every leaf wants the same answer.
	 *
	 * A THIRD door rather than more traffic through the second. The assign picker used to
	 * read its options on `onPlanChanged`, which is right for exactly one of the six event
	 * types that door carries — `ProjectIndexRebuilt`, without which a leaf restored before
	 * `onLayoutReady` offers an empty picker for its whole life — and wasteful for the other
	 * five, which re-read every asset note in the vault once per zone gesture.
	 */
	onCatalogueChanged(listener: () => void): () => void;
	/**
	 * Subscribe to every vault file event, by PATH — the door `BackgroundLayer` needs and the
	 * only one in this context that is not about a domain event at all.
	 *
	 * A background document is a PNG or a PDF the user put in their vault, so nothing in this
	 * plugin's write pipeline hears about it changing and the reference in the note does not move
	 * when the file does. Without this the layer noticed a replaced or deleted sheet only when
	 * something ELSE re-read the plan — the residual its own document key disclosed and a review
	 * bot reported. `createVaultFileChangeSource` is what the composition root binds; the layer
	 * filters on the path it is drawing.
	 */
	onVaultFileChanged(listener: (path: string) => void): () => void;
	/**
	 * Close THIS leaf — the tab the user is looking at.
	 *
	 * The one thing a Plan Editor can offer a user whose plan is gone. `GetPlan` answering
	 * `ok(null)` means this tab points at something the vault no longer holds, and there is
	 * nothing to retry: the plan is not coming back, so the only useful action is to stop
	 * looking at it.
	 *
	 * A narrow callback rather than the `WorkspaceLeaf` itself, for the reason `onThemeChange`
	 * gives about the `Workspace`: the tree's only interest is "close me", and handing it the
	 * leaf would let any component reach the rest of it. The VIEW owns the Obsidian object and
	 * partially applies it here, exactly as it already does for `onPlanChanged`.
	 *
	 * Added in design slice 17. That slice shipped the dangling-reference state with no action
	 * at all and recorded why — this seam did not exist, and reaching for the global `app`
	 * instead is what the marketplace rules refuse.
	 */
	closeLeaf(): void;
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
