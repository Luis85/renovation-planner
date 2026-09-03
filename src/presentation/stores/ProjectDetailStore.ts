import { defineStore } from 'pinia';
import { computed, ref, type Ref } from 'vue';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import { isErr } from '../../core/result/Result';
import { selectProjectDetailEmptyState } from '../emptyStates/selectors';
import type { RenovationProjectQueryServices } from '../read-models/renovationProjectQueries';
import type { PlanSummaryDto, ProjectSummaryDto } from '../read-models/PlanDto';
import type { AssetPriceRowDto } from '../../application/queries/ListProjectAssetPrices';

/**
 * How far the detail state got, and `'gone'` is the member the other two stores here do not
 * have.
 *
 * `'gone'` means "the scan has run and this project is not in the vault", which is what
 * `ProjectDetailState` draws its own screen for. It is a STATUS rather than a callback the store
 * fires, so the store stays a pure function of what the queries answered and what to DRAW stays
 * a rendering rule — slice 14's own division between a selector and a component.
 *
 * `'failed'` is separate from it for the reason `ProjectStoreStatus` keeps its own two apart:
 * a failed read is a real problem, and calling one `'gone'` would tell a user their project was
 * deleted because their vault hiccuped.
 */
type ProjectDetailStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'gone';


/**
 * The price section's own state and its own read, with its own request ticket.
 *
 * A factory beside the store rather than four more lines inside it, and the reason is a budget
 * that had already been spent: `defineStore`'s setup arrow measured 104 effective lines against
 * `max-lines-per-function`'s 100 once this region was inlined, and CLAUDE.md's account of
 * `runtime.ts` is why the answer is an extraction rather than a collapsed literal. It is also a
 * coherent seam rather than a convenient one — everything here is "what does this project pay",
 * and nothing here touches `status` or `error`.
 *
 * **A SECOND ticket, not the store's.** The price read's callers are the mount, a catalogue
 * change and a project-price change, all of which can be in flight while a `hydrate` is — so
 * sharing `latestHydration` would let a price read cancel a project read, and each other's, on a
 * question neither is asking. Two reads, two orderings.
 *
 * A ticket ORDERS reads it did not issue; it cannot stop one STARTING, which is the single-flight
 * loader's job one layer up in `ProjectDetailState`. Both stay because neither does the other's:
 * a fresh mount racing a refresh is the ticket's case, and a sync burst is the loader's.
 */
function createPriceSection(): {
	/** The whole shared catalogue with this project's own price beside each default. */
	readonly assetPrices: Ref<readonly AssetPriceRowDto[]>;
	/**
	 * Non-null exactly when the price read failed. Its own field rather than the store's `error`,
	 * because the two replace different regions: that one replaces the whole detail state, and
	 * this one replaces the price list while the project, its header and its plans stay drawn.
	 */
	readonly assetPricesError: Ref<RepositoryError | null>;
	// `this: void` on both, so `hydratePrices: prices.hydrate` below is a plain function
	// reference rather than a method torn off an object — the shape `unbound-method` refuses.
	hydrate(this: void, queries: RenovationProjectQueryServices, projectId: string): Promise<void>;
	clear(this: void): void;
} {
	const assetPrices = ref<readonly AssetPriceRowDto[]>([]);
	const assetPricesError = ref<RepositoryError | null>(null);
	let latest = 0;

	return {
		assetPrices,
		assetPricesError,
		/**
		 * Run on every occasion the section has — the mount, a catalogue change, a price change,
		 * and after a successful price edit.
		 *
		 * It touches neither `status` nor `error`: a project whose prices could not be read is
		 * still a project the user can look at and work in. It DOES clear the rows on a failure,
		 * because a section showing prices beside a message saying they could not be read is a
		 * section disagreeing with itself — `fail`'s rule, applied to the region that owns it.
		 */
		async hydrate(queries, projectId) {
			const request = ++latest;
			const listed = await queries.listAssetPrices(projectId);
			if (request !== latest) return;
			if (isErr(listed)) {
				assetPrices.value = [];
				assetPricesError.value = listed.error;
				return;
			}
			assetPrices.value = listed.value;
			assetPricesError.value = null;
		},
		/** Takes a ticket as well as emptying, so a read already in flight cannot land after it. */
		clear() {
			latest += 1;
			assetPrices.value = [];
			assetPricesError.value = null;
		},
	};
}

/**
 * One project's detail state (design slice 21) — never a write path, exactly like
 * `RenovationProjectStore`: nothing here calls a repository, and everything is rebuildable by
 * re-running `getProject`/`listPlansByProject` (ADR-005).
 */
export const useProjectDetailStore = defineStore('project-detail', () => {
	const project = ref<ProjectSummaryDto | null>(null);
	const plans = ref<readonly PlanSummaryDto[]>([]);
	/**
	 * How many of this project's plan notes could not be read. `ProjectStore.unreadableZones`
	 * on the other surface, for the same reason: the region draws every plan it has AND says
	 * how many it does not, so one bad note costs one plan rather than the project's list.
	 *
	 * Cleared at all three places `plans` is, so it can never outlive the read it describes.
	 */
	const unreadablePlans = ref(0);
	const status = ref<ProjectDetailStatus>('idle');
	const error = ref<RepositoryError | null>(null);
	const prices = createPriceSection();
	const { assetPrices, assetPricesError } = prices;

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
		unreadablePlans.value = 0;
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
	 * scan, but what that difference DOES depends on where `status` already was:
	 *
	 * - Not yet `'ready'` (`'idle'`, already `'loading'`): there is nothing on screen to
	 *   prefer over "still loading", so a miss before the scan has run holds the loading
	 *   line, and only a completed scan's `ok(null)` is authoritative enough to call the
	 *   project `'gone'`.
	 * - Already `'ready'`: the guard above never let `status` leave `'ready'`, and this
	 *   branch does not touch it either — a pre-scan miss on an already-drawn project leaves
	 *   the project and its plans exactly as they were, rather than adopting the loading
	 *   line. That is the flicker guard's OWN trade applied to this branch and not a second
	 *   oversight beside it: the miss is transient and self-corrects the moment the scan
	 *   completes and the next `onProjectsChanged`/`onPlansChanged` re-hydrate lands, and
	 *   blanking a project that is correctly rendered — because a pre-scan read transiently
	 *   could not find it — is the worse of the two wrong answers. What was on screen was
	 *   true a moment ago; the loading line asserts nothing at all.
	 *
	 * A COMPLETED scan's `ok(null)` is authoritative regardless of where `status` started,
	 * which is why only the `'gone'` assignment below is conditioned on `indexScanCompleted`
	 * and not on `status`.
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
		plans.value = listed.value.plans;
		unreadablePlans.value = listed.value.unreadable;
		status.value = 'ready';
	}

	/**
	 * `'gone'` settled from a COMMAND's refusal rather than discovered by a read.
	 *
	 * `CreatePlanCommand` answers `plan.project-not-found` when the project this state is about
	 * was deleted from under an open form, and that is a STRONGER statement than any re-read
	 * can make: the index may not have caught up, so `hydrate` could still answer `'ready'` and
	 * leave the user on a project the command has just refused to write to. Asking the read to
	 * rediscover what the write already knows is the weaker of the two, and it fails in the
	 * direction that strands somebody.
	 *
	 * It takes a hydration ticket for the reason `reset` does — a read that started BEFORE the
	 * refusal must not settle `'ready'` after it — and it clears the content for the reason
	 * `fail` does, since a store holding a project it has just declared gone is a store that
	 * disagrees with itself.
	 *
	 * **No navigation is here, and since the `'gone'` watcher was retired there is none anywhere.**
	 * This settles a STATUS and `ProjectDetailState`'s `v-else-if` draws the screen for it — one
	 * answer to "this project is not there", reached identically from a read that missed, from
	 * this command refusal, and from a back-arrow restore of a project that has since been
	 * deleted. What it replaced was a redirect, and the redirect recorded a history entry nobody
	 * asked for; that component's own template comment carries the measurement.
	 *
	 * Its earlier form was reported by a review bot, which found the stale-`'ready'` half by
	 * reading the failure path this repository had only ever driven on its happy one.
	 */
	function markGone(): void {
		latestHydration += 1;
		// The price region too: a read still in flight for a project the command has just
		// declared gone must not land its rows under the screen that says so.
		prices.clear();
		project.value = null;
		plans.value = [];
		unreadablePlans.value = 0;
		error.value = null;
		status.value = 'gone';
	}

	/**
	 * Structurally gated on `'ready'`, so a failed or missing read is literally unreachable
	 * from an empty state rather than merely unreached by convention.
	 */
	const emptyStateKey = computed(() =>
		status.value === 'ready'
			? selectProjectDetailEmptyState(plans.value, unreadablePlans.value)
			: null,
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
		prices.clear();
		project.value = null;
		plans.value = [];
		unreadablePlans.value = 0;
		error.value = null;
		status.value = 'idle';
	}

	return {
		project,
		plans,
		unreadablePlans,
		assetPrices,
		assetPricesError,
		status,
		error,
		emptyStateKey,
		hydrate,
		hydratePrices: prices.hydrate,
		markGone,
		reset,
	};
});
