import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { isErr } from '../../core/result/Result';
import { selectRenovationProjectEmptyState } from '../emptyStates/selectors';
import type { RenovationProjectQueryServices } from '../read-models/renovationProjectQueries';
import type { ProjectSummaryDto } from '../read-models/PlanDto';

/**
 * How far the current Renovation Project view got loading its project list.
 *
 * `failed` is distinct from `ready` for the same reason `ProjectStore`'s statuses stay
 * apart: a failed read is a real problem, and `emptyStateKey` (below) is built to be
 * structurally unreachable from it, not merely unreached by convention.
 */
type RenovationProjectStoreStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * The Renovation Project view's working copy of the project list — never a write path,
 * exactly like `ProjectStore`: nothing here calls a repository, and everything is
 * rebuildable by re-running `listProjects` (ADR-005).
 */
export const useRenovationProjectStore = defineStore('renovation-project', () => {
	const projects = ref<readonly ProjectSummaryDto[]>([]);
	/**
	 * How many project notes refused to load on the last successful read. Zero on a failure
	 * as well as on a clean read: a wholesale failure has no per-note count behind it, and a
	 * stale one outliving the read it described would be presented as a fact by whatever
	 * renders it next.
	 */
	const unreadable = ref(0);
	const status = ref<RenovationProjectStoreStatus>('idle');
	const error = ref<RepositoryError | null>(null);

	/**
	 * The ticket every `hydrate` call takes before its first await, so a slower earlier read
	 * cannot land on top of a faster later one.
	 *
	 * There is one caller today — the view's own `onMounted` — but `ProjectStore` carried
	 * exactly this same mechanism through a slice where it had one caller too, and gained a
	 * second later (the post-command refresh funnel, beside the plan-change listener). A
	 * hydration ticket added only once a second caller exists is a ticket added one bug too
	 * late: the failure it guards against — a just-created project vanishing with no error
	 * anywhere, because the LAST resolution wins whether or not it is the freshest — happens
	 * on the very first overlapping pair of calls, not on some later one a reviewer can catch
	 * in time.
	 */
	let latestHydration = 0;

	/**
	 * A failed read leaves NO stale list behind. Drawing a list beside an error saying it
	 * could not be read is the worse of the two wrong answers — `ProjectStore.fail` states
	 * the identical rule.
	 */
	function fail(cause: RepositoryError): void {
		projects.value = [];
		unreadable.value = 0;
		error.value = cause;
		status.value = 'failed';
	}

	/**
	 * The one hydration routine, run on open and on the post-command refresh design slice 16
	 * added (`ViewRoot.onCreateProject`, after a successful create).
	 *
	 * `status` drops to `'loading'` only when it is not already `'ready'` — the same guard
	 * `ProjectStore.hydrate` carries, and for the identical reason: a re-hydration of an
	 * already-`'ready'` view must not make `emptyStateKey` swing through `null` for the tick
	 * the read is in flight. This store's docblock used to record that gap as future work
	 * ("the day a later slice re-hydrates this store after creating a project ... fixing it
	 * is a one-line change") — that slice is this one, `onCreateProject`'s re-hydrate is the
	 * second caller, and without the guard every successful create flipped the pane from the
	 * empty state to the `.rp-view-message` loading line and back, a real and avoidable
	 * flicker on the one flow this mechanism exists to serve. The guard is exactly the
	 * one-line fix the earlier paragraph predicted.
	 */
	async function hydrate(queries: RenovationProjectQueryServices): Promise<void> {
		const request = ++latestHydration;
		const superseded = (): boolean => request !== latestHydration;

		if (status.value !== 'ready') status.value = 'loading';
		error.value = null;

		const found = await queries.listProjects();
		if (superseded()) return;
		if (isErr(found)) {
			fail(found.error);
			return;
		}

		projects.value = found.value.projects;
		unreadable.value = found.value.unreadable;
		status.value = 'ready';
	}

	/**
	 * Which empty state this view is in, or `null` for a normal render (design slice 14).
	 *
	 * Guarded by `status` rather than by `projects.length` alone: `null` unless
	 * `status === 'ready'` is what makes "a failed read is never rendered as an empty state"
	 * hold STRUCTURALLY — the selector is literally unreachable from `'failed'` or
	 * `'loading'` or `'idle'`, rather than merely unreached because nothing today calls it
	 * from those branches.
	 */
	const emptyStateKey = computed(() =>
		status.value === 'ready'
			? selectRenovationProjectEmptyState(projects.value, unreadable.value)
			: null,
	);

	/**
	 * Rebuilds this store to its opening state (ADR-005). Nothing calls this today —
	 * `RenovationProjectView.onOpen` creates a fresh Pinia per open rather than reusing one
	 * across closes, so there is no reused leaf yet for this to protect. Declared for the
	 * same reason `Zone.area()` is kept rather than trimmed: a shape that is deleted
	 * whenever nothing calls it stops being a declared shape, and the guarantee it states
	 * — that this store is fully rebuildable from the same query at any time — is worth
	 * keeping stated and tested even with zero callers.
	 */
	function reset(): void {
		// Invalidates any hydration still in flight, exactly as `ProjectStore.reset` does.
		latestHydration += 1;
		projects.value = [];
		unreadable.value = 0;
		error.value = null;
		status.value = 'idle';
	}

	return { projects, unreadable, status, error, emptyStateKey, hydrate, reset };
});
