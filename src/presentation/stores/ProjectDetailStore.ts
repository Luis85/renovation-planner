import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { isErr } from '../../core/result/Result';
import { selectProjectDetailEmptyState } from '../emptyStates/selectors';
import type { RenovationProjectQueryServices } from '../read-models/renovationProjectQueries';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';

/**
 * How far the detail state got, and `'gone'` is the member the other two stores here do not
 * have.
 *
 * `'gone'` means "the scan has run and this project is not in the vault", which is what
 * `ViewRoot` navigates back to the list on. It is a STATUS rather than a callback the store
 * fires, so the store stays a pure function of what the queries answered and "navigate" stays
 * a rendering rule — slice 14's own division between a selector and a component.
 *
 * `'failed'` is separate from it for the reason `ProjectStoreStatus` keeps its own two apart:
 * a failed read is a real problem, and navigating on one would tell a user their project was
 * deleted because their vault hiccuped.
 */
type ProjectDetailStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'gone';

/**
 * One project's detail state (design slice 21) — never a write path, exactly like
 * `RenovationProjectStore`: nothing here calls a repository, and everything is rebuildable by
 * re-running `getProject`/`listPlansByProject` (ADR-005).
 */
export const useProjectDetailStore = defineStore('project-detail', () => {
	const project = ref<ProjectSummaryDto | null>(null);
	const plans = ref<readonly PlanSummaryDto[]>([]);
	const status = ref<ProjectDetailStatus>('idle');
	const error = ref<RepositoryError | null>(null);

	/**
	 * The ticket every `hydrate` takes before its first await, so a slower earlier read cannot
	 * land on top of a faster later one — `ProjectStore.hydrate` and `InspectorStore` carry
	 * the same mechanism. This store has FOUR callers from day one, which is exactly the
	 * condition that made the ticket necessary there: the mount, `onProjectsChanged`, the
	 * awaited re-read after a successful create, and `onPlansChanged`.
	 */
	let latestHydration = 0;

	/** A failed read leaves NO stale content behind — `ProjectStore.fail`'s rule. */
	function fail(cause: RepositoryError): void {
		project.value = null;
		plans.value = [];
		error.value = cause;
		status.value = 'failed';
	}

	/**
	 * `status` drops to `'loading'` only when it is not already `'ready'` — the same guard
	 * `RenovationProjectStore.hydrate` carries, and the exposure here is WIDER than there:
	 * `onPlansChanged`'s index arm fires for any plan note in the vault, so without this a
	 * background sync flickers the whole detail state through its loading line while the user
	 * is reading it.
	 *
	 * `indexScanCompleted` is passed IN rather than read, because the store may not reach the
	 * plugin. It answers one question — has the initial scan RUN, zero entries included — and
	 * it is the difference between an authoritative `ok(null)` and one that merely raced the
	 * scan. Until it is true, a missing project holds the loading state; from then on it is
	 * the list.
	 *
	 * The two reads COMBINE all-or-nothing: there is no honest picture of a project whose
	 * identity loaded but whose plans did not.
	 */
	async function hydrate(
		queries: RenovationProjectQueryServices,
		projectId: string,
		indexScanCompleted: boolean,
	): Promise<void> {
		const request = ++latestHydration;
		const superseded = (): boolean => request !== latestHydration;

		if (status.value !== 'ready') status.value = 'loading';
		error.value = null;

		const found = await queries.getProject(projectId);
		if (superseded()) return;
		if (isErr(found)) {
			fail(found.error);
			return;
		}
		if (found.value === null) {
			// Not authoritative until the scan has run: a leaf restored before `onLayoutReady`
			// asks an EMPTY index and is answered a legitimate `ok(null)`. Going there would
			// destroy the `projectId` this state is about, and no later read could restore it.
			if (indexScanCompleted) status.value = 'gone';
			return;
		}

		const listed = await queries.listPlansByProject(projectId);
		if (superseded()) return;
		if (isErr(listed)) {
			fail(listed.error);
			return;
		}

		project.value = found.value;
		plans.value = listed.value;
		status.value = 'ready';
	}

	/**
	 * Structurally gated on `'ready'`, so a failed or missing read is literally unreachable
	 * from an empty state rather than merely unreached by convention.
	 */
	const emptyStateKey = computed(() =>
		status.value === 'ready' ? selectProjectDetailEmptyState(plans.value) : null,
	);

	/**
	 * Rebuilds this store to its opening state (ADR-005). Nothing calls it today: every
	 * navigation REMOUNTS, so each detail state gets a fresh `createPinia()` and this store
	 * has no cross-navigation lifetime to protect. Declared for the reason
	 * `RenovationProjectStore.reset` is — a shape deleted whenever nothing calls it stops
	 * being a declared shape.
	 */
	function reset(): void {
		latestHydration += 1;
		project.value = null;
		plans.value = [];
		error.value = null;
		status.value = 'idle';
	}

	return { project, plans, status, error, emptyStateKey, hydrate, reset };
});
