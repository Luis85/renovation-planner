import type { PlanEditorQueryServices } from '../../read-models/planEditorQueries';
import { withStateRefresh, type RefreshedHistory } from './with-state-refresh';

/** Both stores hold working state; both are refreshed, never one standing in for the other. */
export interface EditorStateRefreshDeps {
	/**
	 * Slice 5's own hydration routine, re-run after every committed operation with
	 * `keepPreviousOnFailure: true` — a refresh is a read of data that is already
	 * written, and its failure must neither blank the canvas nor alter the wrapped
	 * `Result`.
	 */
	projectStore: {
		hydrate(
			queries: PlanEditorQueryServices,
			planId: string,
			options?: { readonly keepPreviousOnFailure?: boolean },
		): Promise<void>;
	};
	/** Slice 6's own invalidation of the cached Inspector DTO. Only this member. */
	inspectorStore: { refresh(): Promise<void> };
	queries: PlanEditorQueryServices;
	/** The plan this editor leaf shows; every refresh re-reads exactly it. */
	planId: string;
}

/**
 * The Plan Editor's SUBJECT for `withStateRefresh` (design slice 8, widened by the trust-path
 * spec §2.3): what "read back what was just written" means for this surface, and nothing about
 * the queue or the rejection path, which are `./with-state-refresh.ts`'s and are shared with the
 * asset designer.
 *
 * The canvas re-hydration runs first and the Inspector second: a selection is only meaningful
 * against the entity map the canvas hit-tests, so a new DTO must never pair with a pre-command
 * entity set.
 *
 * **Named and exported on its own, rather than an anonymous closure inside `withEditorStateRefresh`,
 * because it now has a SECOND caller.** §2.3: "retry is the refresh, by construction" — the exact
 * same function the post-command queue awaits is what `runtime.ts` hands out as
 * `EditorRuntime.refreshProjection`, for the stale-projection strip's Try again. Two callers of one
 * function cannot drift the way a closure re-derived at a second call site could; the retry
 * therefore cannot replay a write, which `type-safety.test-d.ts` holds as a fact about this
 * function's signature (no command parameter) rather than as a sentence.
 */
export function createProjectionRefresh(deps: EditorStateRefreshDeps): () => Promise<void> {
	return async () => {
		await deps.projectStore.hydrate(deps.queries, deps.planId, { keepPreviousOnFailure: true });
		await deps.inspectorStore.refresh();
	};
}

/**
 * `withStateRefresh` bound to this surface's own refresh (above). Kept as a thin wrapper — every
 * existing caller of THIS function is unaffected — while `runtime.ts` calls `createProjectionRefresh`
 * and `withStateRefresh` directly, since it needs the refresh function itself as a named value to
 * hand out, not only wrapped into a decorated history.
 */
export function withEditorStateRefresh(
	history: RefreshedHistory,
	deps: EditorStateRefreshDeps,
): RefreshedHistory {
	return withStateRefresh(history, createProjectionRefresh(deps));
}
