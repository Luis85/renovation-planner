import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { isErr } from '../../core/result/Result';
import type { PlanEditorQueryServices } from '../read-models/planEditorQueries';
import type { PlanDto, ProjectSummaryDto, ZoneDto } from '../read-models/PlanDto';

/**
 * How far the current Plan Editor got loading its Plan.
 *
 * `missing` and `failed` are distinct states because the queries keep them distinct
 * (`ok(null)` vs `isErr`), and collapsing them here would waste that: slice 14's empty
 * states want "this plan does not exist" and slice 17's error surfacing wants "the vault
 * read failed", and no code downstream could tell them apart again.
 */
type ProjectStoreStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'failed';

/**
 * The Plan Editor's working copy of persisted data (SDD §14), and never a write path:
 * nothing here calls a repository, and everything in it is rebuildable by re-running the
 * same two queries (ADR-005). A crash or a forced Pinia reset loses no project data,
 * because nothing canonical ever lived only here.
 *
 * Zones are keyed by `ZoneId` — never by array index and never by Konva node identity —
 * so a later slice's re-hydration reconciles by domain id, which is the only identity
 * that survives a redraw.
 */
export const useProjectStore = defineStore('project', () => {
	const project = ref<ProjectSummaryDto | null>(null);
	const plan = ref<PlanDto | null>(null);
	const zones = ref<ReadonlyMap<string, ZoneDto>>(new Map());
	const status = ref<ProjectStoreStatus>('idle');
	const error = ref<RepositoryError | null>(null);

	/**
	 * A failed read leaves NO stale plan behind. Keeping the previous one would draw a
	 * canvas that looks current beside an error saying it is not, which is the worse of
	 * the two wrong answers.
	 */
	function fail(cause: RepositoryError): void {
		plan.value = null;
		zones.value = new Map();
		error.value = cause;
		status.value = 'failed';
	}

	/**
	 * The ONE hydration routine (§35's two queries), run on open.
	 *
	 * Slice 8 adds the other moment it runs — after every committed command, so the canvas
	 * shows what was just written — and re-uses this rather than growing a second one. That
	 * is why it takes the query services as an argument instead of closing over them: a
	 * store that captured its own dependencies at definition time could not be re-pointed,
	 * and each Plan Editor leaf has its own Pinia holding its own Plan.
	 *
	 * The zones query is not run when the Plan is absent or unreadable: there is nothing to
	 * draw them on, and listing the zones of a plan that does not exist is a vault read
	 * whose only possible answer is empty.
	 */
	async function hydrate(queries: PlanEditorQueryServices, planId: string): Promise<void> {
		// A RE-hydration does not blank the editor. The root mounts its canvas on `ready`, so
		// dropping to `loading` here would unmount the Konva stage and build a fresh one on
		// every committed command — the whole canvas flashing because one background
		// reference changed, and every camera position lost with it. Only the first load, or
		// a load after a failure, has nothing to keep showing.
		if (status.value !== 'ready') status.value = 'loading';
		error.value = null;

		const foundPlan = await queries.getPlan(planId);
		if (isErr(foundPlan)) {
			return fail(foundPlan.error);
		}
		if (foundPlan.value === null) {
			plan.value = null;
			zones.value = new Map();
			status.value = 'missing';
			return;
		}

		const foundZones = await queries.findZonesByPlan(planId);
		if (isErr(foundZones)) {
			return fail(foundZones.error);
		}

		plan.value = foundPlan.value;
		zones.value = new Map(foundZones.value.map((zone) => [zone.id, zone]));
		status.value = 'ready';
	}

	/** What the view calls on close, so a reused leaf never opens onto the last Plan. */
	function reset(): void {
		project.value = null;
		plan.value = null;
		zones.value = new Map();
		error.value = null;
		status.value = 'idle';
	}

	/**
	 * `project` is exposed and nothing reads it yet: it is a field of the `ProjectStoreState`
	 * SDD §14 names, and the Plan Editor needs no project-level data until slice 6 gives the
	 * Inspector something to show. Suppressed rather than deleted for the reason
	 * `Zone.area()` is: a declared shape that gets trimmed whenever nothing calls it stops
	 * being a declared shape.
	 */
	// fallow-ignore-next-line unused-store-member
	return { project, plan, zones, status, error, hydrate, reset };
});
