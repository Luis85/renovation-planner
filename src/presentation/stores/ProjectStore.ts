import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { isErr } from '../../core/result/Result';
import { selectPlanEditorEmptyState } from '../emptyStates/selectors';
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
	/**
	 * How many of this plan's zone notes could not be read.
	 *
	 * A separate field from `zones` because it is a fact about the READ rather than about the
	 * scene: the canvas draws every zone it has AND says how many it does not have, which is
	 * what makes one bad note cost one zone instead of the whole plan.
	 *
	 * Written only on a successful hydrate, beside `zones`, and cleared wherever `zones` is —
	 * so it can never describe a different read than the one on screen.
	 */
	const unreadableZones = ref(0);
	const status = ref<ProjectStoreStatus>('idle');
	const error = ref<RepositoryError | null>(null);
	/**
	 * Is what the canvas is drawing older than the vault?
	 *
	 * **A separate fact from `error`, and it took three review findings in a row to stop
	 * pretending otherwise.** `error` answers "why is there nothing to show" — it is set by
	 * `fail()`, beside `plan = null` and `status = 'failed'`, for a load that gave up. Design
	 * slice 17's stale-data strip needed a different question, "the content on screen is real
	 * but may be out of date", and read it off `error` because the `keepPreviousOnFailure`
	 * path happens to set that field too. Every consequence of that overloading came back as
	 * a defect: the strip appeared for the wrong reason, then withdrew for the length of a
	 * keep-on-failure read, then withdrew for the length of an ORDINARY one — `PlanEditorRoot`
	 * subscribes a plain `hydrate()` to `onPlanChanged`, and with `status` already `'ready'`
	 * that path leaves the canvas mounted while clearing the field the warning was reading.
	 *
	 * Patching the clear a third time would have been the third patch to the same overloaded
	 * field. This is the field the warning actually means, so the lifetime is stated once and
	 * every hydration path gets it right by construction: set where a read fails with content
	 * still on screen, cleared by the one event that makes the canvas current again — a read
	 * that SUCCEEDED — and cleared by `fail()`, where the stale content is gone with it.
	 */
	const stale = ref(false);
	/**
	 * The ticket every `hydrate` call takes before its first await, so a slower earlier
	 * read cannot land on top of a faster later one.
	 *
	 * There are two concurrent callers now, not one: the post-command refresh funnel
	 * (`withEditorStateRefresh`) and the plan-change listener the root subscribes — and
	 * `ProjectIndexRebuilt` reaches every leaf regardless of which plan it touched. Two
	 * overlapping hydrations would otherwise resolve in whatever order the vault answered,
	 * and the LAST assignment wins whether or not it is the freshest: a just-drawn zone
	 * disappears from the canvas with no error anywhere. `InspectorStore` guards exactly
	 * this with the same mechanism.
	 */
	let latestHydration = 0;

	/**
	 * A failed read leaves NO stale plan behind. Keeping the previous one would draw a
	 * canvas that looks current beside an error saying it is not, which is the worse of
	 * the two wrong answers.
	 */
	function fail(cause: RepositoryError): void {
		plan.value = null;
		zones.value = new Map();
		unreadableZones.value = 0;
		error.value = cause;
		status.value = 'failed';
		// Nothing is on screen to BE stale: this path blanks the plan and the failure state
		// replaces the canvas.
		stale.value = false;
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
	 *
	 * **The `keepPreviousOnFailure` option is slice 8's, and only its.** A re-hydration
	 * after a command whose WRITE succeeded is a different situation from an open-time
	 * load: the vault state is newer than what the store shows, so blanking it would
	 * replace "possibly stale" with definitely nothing — and through slice 13's save-state
	 * tracking would read as a save error over a save that worked. There the failed read
	 * keeps what the store had and surfaces the cause through `error` alone; slice 17's
	 * rules for a failed hydrating read own how that reaches the user. Open-time loads keep
	 * the default: a first paint has no previous contents to keep, and a re-open after a
	 * failure must not draw a plan beside an error saying it could not be read.
	 */
	async function hydrate(
		queries: PlanEditorQueryServices,
		planId: string,
		options?: { readonly keepPreviousOnFailure?: boolean },
	): Promise<void> {
		const request = ++latestHydration;
		const superseded = (): boolean => request !== latestHydration;
		const keepOnFailure = options?.keepPreviousOnFailure === true;
		// A RE-hydration does not blank the editor. The root mounts its canvas on `ready`, so
		// dropping to `loading` here would unmount the Konva stage and build a fresh one on
		// every committed command — the whole canvas flashing because one background
		// reference changed, and every camera position lost with it. Only the first load, or
		// a load after a failure, has nothing to keep showing.
		if (status.value !== 'ready') status.value = 'loading';
		// `error` is cleared for the read that is about to happen; `stale` deliberately is NOT.
		// A read that has STARTED has established nothing, and the canvas is still drawing
		// exactly what it was drawing a moment ago — so withdrawing the warning here would be an
		// assurance nothing had earned, for the whole duration of the read. Only a read that
		// SUCCEEDS retires it. See `stale`'s own declaration for why this is a second field
		// rather than a third condition on this one.
		error.value = null;

		const foundPlan = await queries.getPlan(planId);
		if (superseded()) return;
		if (isErr(foundPlan)) {
			if (keepOnFailure && status.value === 'ready') {
				error.value = foundPlan.error;
				// Real content is still on screen and the vault has moved past it.
				stale.value = true;
				return;
			}
			return fail(foundPlan.error);
		}
		if (foundPlan.value === null) {
			plan.value = null;
			zones.value = new Map();
			unreadableZones.value = 0;
			status.value = 'missing';
			return;
		}

		const foundZones = await queries.findZonesByPlan(planId);
		if (superseded()) return;
		if (isErr(foundZones)) {
			if (keepOnFailure && status.value === 'ready') {
				error.value = foundZones.error;
				stale.value = true;
				return;
			}
			return fail(foundZones.error);
		}

		plan.value = foundPlan.value;
		zones.value = new Map(foundZones.value.zones.map((zone) => [zone.id, zone]));
		unreadableZones.value = foundZones.value.unreadable;
		status.value = 'ready';
		// The ONE event that retires a stale-data warning: what is on screen came back from the
		// vault just now. Every hydration path ends here on success, whatever its options, which
		// is what makes the lifetime a property of the store rather than of a caller.
		stale.value = false;
	}

	/**
	 * Which empty state this Plan Editor is in, or `null` for a normal render (design slice
	 * 14). A getter over state this store already hydrates — no new field and no new query,
	 * which is why it is here rather than in a store of its own.
	 *
	 * It reads `plan` and `zones` and NOTHING about the editor: whether an active tool
	 * currently displaces the overlay is a rendering rule, decided in `PlanEditorRoot`. A
	 * store that mixed the two would make "which state is this plan in" unanswerable without
	 * a live tool manager, and this getter's whole value is that it is answerable.
	 *
	 * A missing read never reaches the selector: `plan` is `null` after `fail()` and after
	 * the `foundPlan.value === null` branch above, and the selector returns no key for
	 * that — the `Ok(null)`-is-a-broken-reference rule, not an accident of ordering.
	 *
	 * **A FAILED read is not held to the same guarantee, and that is deliberate, not a gap.**
	 * `keepPreviousOnFailure` (above) exists precisely so a post-command re-read failing
	 * does not blank a canvas that a moment ago showed real content — the empty state has to
	 * agree with what the canvas beside it still shows, not blank out on its own schedule.
	 * So on that path, `status` stays `'ready'`, `plan` stays whatever it already was, and
	 * this getter computes exactly what it would for a normal ready render — a non-null
	 * `plan` can therefore compute a real key while `error` is also set. This store holds
	 * "a failed read is never rendered as an empty state" through `plan === null` PLUS this
	 * stated exception, not structurally the way `RenovationProjectStore.emptyStateKey` does
	 * with its `status === 'ready'` guard — that guard would be redundant everywhere else
	 * here (`missing` and the non-`keepOnFailure` `failed` path already have `plan === null`;
	 * a re-hydration deliberately never drops `status` back to `'loading'`, see the note
	 * above `hydrate`), so adding it would not change behaviour, only appear to promise a
	 * guarantee this store does not keep in the one case that actually needs stating.
	 */
	const emptyStateKey = computed(() =>
		selectPlanEditorEmptyState(plan.value, [...zones.value.values()], unreadableZones.value),
	);

	/**
	 * Rebuilds this store to its opening state (ADR-005). Nothing calls this today — the
	 * Plan Editor mounts a fresh Pinia per leaf and this method has no caller yet — but a
	 * reused leaf reopening onto a stale Plan is exactly the failure this exists to
	 * prevent once something does call it, and a declared, tested shape with no caller is
	 * the same choice `RenovationProjectStore.reset` and `Zone.area()` make for the same
	 * reason.
	 */
	function reset(): void {
		// Invalidates any hydration still in flight: a leaf closing must not have the plan
		// it was reading painted back in a tick later.
		latestHydration += 1;
		project.value = null;
		plan.value = null;
		zones.value = new Map();
		unreadableZones.value = 0;
		error.value = null;
		stale.value = false;
		status.value = 'idle';
	}

	/**
	 * `project` is exposed and nothing reads it yet: it is a field of the `ProjectStoreState`
	 * SDD §14 names, and the Plan Editor needs no project-level data until slice 6 gives the
	 * Inspector something to show. Suppressed rather than deleted for the reason
	 * `Zone.area()` is: a declared shape that gets trimmed whenever nothing calls it stops
	 * being a declared shape.
	 */
	return {
		// The directive means the NEXT LINE literally, so it sits on `project` rather than on
		// the `return` — where it was, and where it went stale the moment this object stopped
		// being one line.
		// fallow-ignore-next-line unused-store-member
		project,
		plan,
		zones,
		unreadableZones,
		status,
		error,
		stale,
		emptyStateKey,
		hydrate,
		reset,
	};
});
