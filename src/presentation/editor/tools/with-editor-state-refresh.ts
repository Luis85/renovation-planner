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
 * The Plan Editor's SUBJECT for `withStateRefresh` (design slice 8): what "read back what was
 * just written" means for this surface, and nothing about the queue or the rejection path,
 * which are `./with-state-refresh.ts`'s and are shared with the asset designer.
 *
 * The canvas re-hydration runs first and the Inspector second, inside the one queued step: a
 * selection is only meaningful against the entity map the canvas hit-tests, so a new DTO must
 * never pair with a pre-command entity set.
 */
export function withEditorStateRefresh(
	history: RefreshedHistory,
	deps: EditorStateRefreshDeps,
): RefreshedHistory {
	return withStateRefresh(history, async () => {
		await deps.projectStore.hydrate(deps.queries, deps.planId, { keepPreviousOnFailure: true });
		await deps.inspectorStore.refresh();
	});
}
