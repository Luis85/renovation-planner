import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { PersistenceError } from '../../core/errors/AppError';
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
	const status = ref<RenovationProjectStoreStatus>('idle');
	const error = ref<PersistenceError | null>(null);

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
	function fail(cause: PersistenceError): void {
		projects.value = [];
		error.value = cause;
		status.value = 'failed';
	}

	/** The one hydration routine, run on open. */
	async function hydrate(queries: RenovationProjectQueryServices): Promise<void> {
		const request = ++latestHydration;
		const superseded = (): boolean => request !== latestHydration;

		status.value = 'loading';
		error.value = null;

		const found = await queries.listProjects();
		if (superseded()) return;
		if (isErr(found)) {
			fail(found.error);
			return;
		}

		projects.value = found.value;
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
		status.value === 'ready' ? selectRenovationProjectEmptyState(projects.value) : null,
	);

	/** What the view calls on close, so a reused leaf never opens onto the last read. */
	function reset(): void {
		// Invalidates any hydration still in flight, exactly as `ProjectStore.reset` does.
		latestHydration += 1;
		projects.value = [];
		error.value = null;
		status.value = 'idle';
	}

	return { projects, status, error, emptyStateKey, hydrate, reset };
});
