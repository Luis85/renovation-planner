import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { isErr } from '../../core/result/Result';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { AssetLibraryChange } from '../../application/events/assetLibraryChangeSource';
import type { CatalogueEntryDto, UnreadableEntry } from '../../application/queries/ListCatalogueEntries';
import type { AssetId } from '../../domain/asset/AssetId';
import { selectAssetLibraryEmptyState } from '../emptyStates/selectors';
import { createViewportMarks } from '../library/viewportMarks';
import type { AssetLibraryQueryServices } from '../read-models/assetLibraryQueries';
import { useAssetSelectionStore } from './AssetSelectionStore';

/**
 * How far this library got reading its catalogue.
 *
 * `failed` is distinct from `ready` for the reason `RenovationProjectStore` keeps them apart:
 * `emptyStateKey` below is structurally unreachable from it rather than merely unreached, so a
 * vault that could not be read can never draw *no assets yet*.
 */
type AssetLibraryStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * §6.1's whole matching rule: **name, supplier and SKU, and never notes** — a free-text field
 * whose matches a row does not show and therefore cannot explain.
 *
 * Case-folded on both sides, and `null` fields simply do not match rather than being coerced to
 * a string, which would let a search for `null` find every asset that has no supplier.
 */
/**
 * §6.1's *ordered by name across categories*, through the same `Intl.Collator` the prototype
 * this surface is ported from already uses rather than a bare `localeCompare` — one collator
 * constructed once, which is what makes ordering a full catalogue on every keystroke cheap.
 *
 * The locale is not read from Obsidian here: `getLanguage()` is `presentation/`'s to resolve at
 * a component, and a store reaching for it would be this module's first Obsidian dependency for
 * a sort order. The default collator follows the runtime's locale, which is the honest answer
 * until something asks for a different one.
 */
const BY_NAME = new Intl.Collator();

function matches(entry: CatalogueEntryDto, needle: string): boolean {
	return [entry.name, entry.supplier, entry.sku].some(
		(field) => field !== null && field.toLowerCase().includes(needle),
	);
}

/**
 * The Asset library's working copy of the catalogue listing and of every mark on screen —
 * never a write path, exactly like every other store here: nothing calls a repository, and
 * everything is rebuildable by re-running the two queries (ADR-005).
 *
 * TWO of §5.5's ticket seams live here and they are different questions, which is why they are
 * two mechanisms rather than one counter:
 * - the LISTING is ticketed on the view — one counter, latest wins — because it is refreshed
 *   by events rather than by a gesture, so two arriving close together is the ordinary case;
 * - a MARK is ticketed per asset, in `viewportMarks.ts`, because invalidation names ids.
 *
 * The selection's three seams are `AssetSelectionStore`'s: a store per lifetime rather than one
 * store holding five, since the whole point of §5.5 is that they are restarted by different
 * things.
 */
export const useAssetLibraryStore = defineStore('asset-library', () => {
	const entries = ref<readonly CatalogueEntryDto[]>([]);
	/**
	 * The notes this build could draw no row for — the LIST, never a count, because §5.1a's
	 * repair strip names each path with its reason and offers `Open note` per row. Emptied on a
	 * failure as well as on a clean read, for the reason `RenovationProjectStore.unreadable`
	 * gives: a stale count outliving the read it described is presented as a fact by whatever
	 * renders it next.
	 */
	const unreadable = ref<readonly UnreadableEntry[]>([]);
	const status = ref<AssetLibraryStatus>('idle');
	const error = ref<RepositoryError | null>(null);
	/**
	 * §6.1's search field, held HERE rather than in the root, and that is a correction rather
	 * than a preference. `emptyStateKey` has to be decided over the list the user is actually
	 * looking at: fed the whole catalogue, §4's ***No matches*** row is structurally unreachable
	 * on any non-empty vault — forty assets and a query matching none of them answers `null`,
	 * and the surface draws an empty result list with no message and no *clear the search*
	 * action. A root that owned the query and a store that owned the getter would be two answers
	 * to one question, which is this repository's own recurring defect; one owner closes it.
	 */
	const query = ref('');
	const marks = createViewportMarks();

	/**
	 * The listing ticket, exactly `RenovationProjectStore.hydrate`'s `latestHydration`. It has
	 * several callers from its first day here — the mount, and every `catalogue` arm of the
	 * change source, which is eight event types — so two rapid `AssetUpdated`s really do
	 * overlap, and without this the slower earlier listing lands last and restores assets the
	 * newer one had seen deleted (§5.5's own worked example, and the read that made this
	 * section a rule over a category rather than a list of three).
	 */
	let latestHydration = 0;

	/** A failed read leaves NO stale rows behind — `ProjectStore.fail` states the same rule. */
	function fail(cause: RepositoryError): void {
		entries.value = [];
		unreadable.value = [];
		error.value = cause;
		status.value = 'failed';
	}

	/**
	 * The one hydration routine, run on open and on every `catalogue` change.
	 *
	 * **`indexScanCompleted` is read BEFORE the listing read, and that reading alone decides.**
	 * Obsidian restores its leaves before `onLayoutReady` and the index scan runs from it, so
	 * `listAll()` enumerates an EMPTY index and answers a perfectly legitimate `ok([])` — which a
	 * view mapping to §4's Empty row draws as *no assets yet* with a `New asset` button under it,
	 * and a renovator who takes that invitation defines the duplicate this whole feature exists to
	 * prevent. The question is whether the scan RAN, never whether it FOUND anything: "is the
	 * index populated" hangs a restored pane for ever in a vault whose last asset note was deleted
	 * while Obsidian was closed.
	 *
	 * BEFORE, because that is the moment the answer describes. A gate asked AFTER describes the
	 * moment the read RETURNED, so a scan completing while the read is out publishes a pre-scan
	 * `ok([])` as `'ready'` — the one window it cannot see, and the whole defect. Reading before
	 * refuses that same listing conservatively instead, and the refusal costs nothing:
	 * `ProjectIndexRebuilt` is published unconditionally by the very function that sets the flag,
	 * and this store re-hydrates on it through `applyChange`.
	 *
	 * A second reading after the read was tried and DELETED rather than kept for symmetry: the
	 * flag is monotonic — `RenovationPlannerPlugin.indexScanCompleted` has exactly one assignment,
	 * to `true` — so `!scannedBefore || !indexScanCompleted()` can differ from `!scannedBefore`
	 * only for a supplier that goes back to false, which nothing in this tree can produce. No
	 * mutation could redden it and v8 reports it as covered, which is the same shape as
	 * `applyListing`'s deleted null guard: a branch that reads as checked and is not.
	 *
	 * The pre-scan answer is DROPPED rather than published under a `loading` status, so this
	 * store never holds a listing taken before the index existed — a consumer reading `entries`
	 * without checking `status` cannot draw one.
	 *
	 * `status` drops to `'loading'` only when it is not already `'ready'`, the same guard
	 * `RenovationProjectStore.hydrate` carries and for the identical reason: an event-driven
	 * re-read of a drawn library must not flick the shelves out for the tick it is in flight.
	 */
	async function hydrate(
		queries: AssetLibraryQueryServices,
		indexScanCompleted: () => boolean,
	): Promise<void> {
		const request = ++latestHydration;
		const superseded = (): boolean => request !== latestHydration;
		const scannedBefore = indexScanCompleted();
		// **Resolved above the first await, and that is the whole of Important A.** `useStore()`
		// with no argument resolves through pinia's module-global `activePinia`, and every
		// function a setup store returns is wrapped as an action that re-points it at invocation
		// — so a store action in ANOTHER leaf while this listing read is out would hand the
		// backstop that leaf's selection store. Measured with two piniass: the call lands on the
		// other leaf's store, plants a stray one there, and the real one is never told. Every
		// view mounts its own `createPinia()`, so this is the ordinary two-leaf case rather than
		// an exotic one.
		const selection = useAssetSelectionStore();

		if (status.value !== 'ready') status.value = 'loading';
		error.value = null;

		const found = await queries.listCatalogue();
		if (superseded()) return;
		if (isErr(found)) {
			fail(found.error);
			return;
		}
		if (!scannedBefore) {
			status.value = 'loading';
			return;
		}

		entries.value = found.value.entries;
		unreadable.value = found.value.unreadable;
		status.value = 'ready';
		// §5.5's listing backstop, applied HERE rather than left to whoever calls `hydrate`. Its
		// absence is the most invisible of this task's obligations — the `replaced` event covers
		// the common case, so a forgotten call shows up only for an entry that leaves with no
		// event at all — and there is exactly one moment it is owed: a listing having been
		// applied, which is this line.
		await selection.applyListing(found.value.entries, queries);
	}

	/** Whether §6.1's field holds a query. Derived, never written — a flag a caller has to keep
	 *  in step with the field it describes is a flag that will disagree with it. */
	const searching = computed(() => query.value.trim() !== '');

	/**
	 * What the shelves actually draw: the whole catalogue, or §6.1's matches, ordered by name.
	 *
	 * THE filter, and the only one — a root that matched for itself would leave the empty state
	 * deciding over a different list from the one on screen. And THE order: §6.1 asks for the flat
	 * result list *ordered by name across categories*, which is a property of what is drawn and
	 * would otherwise be a fourth thing a later task has to remember. Applied unsearched too,
	 * since one list under two orders is two lists.
	 *
	 * `entries` is deliberately NOT exported beside it. The argument for one owner of *what is
	 * drawn* is undone the moment a root can render the unfiltered list by mistake, and a docblock
	 * saying which to use is exactly the convention this round has been deleting. §3.6's status
	 * bar wants the library's SIZE (`54 assets`), which is `total` below — a number nothing can
	 * render as rows.
	 */
	const visibleEntries = computed(() => {
		const needle = query.value.trim().toLowerCase();
		const matched = needle === '' ? entries.value : entries.value.filter((entry) => matches(entry, needle));
		return matched.toSorted((one, other) => BY_NAME.compare(one.name, other.name));
	});

	/**
	 * Which empty state this library is in, or `null` for a normal render.
	 *
	 * Guarded by `status === 'ready'` for the structural reason its three siblings are; fed
	 * `visibleEntries` because §4's ***No matches*** row is a fact about the DRAWN list; and fed
	 * the REAL unreadable count rather than a zero, because `selectAssetLibraryEmptyState`'s
	 * first statement refuses unconditionally on `unreadable > 0` and a getter passing `0` would
	 * reintroduce the exact defect that guard exists for — inviting a user to create their first
	 * asset over a catalogue full of notes this build could not parse.
	 */
	const emptyStateKey = computed(() =>
		status.value === 'ready'
			? selectAssetLibraryEmptyState(visibleEntries.value, unreadable.value.length, searching.value)
			: null,
	);

	/**
	 * The two arms of `AssetLibraryChange` this store owns, routed in one place rather than at
	 * the subscription site: a view that spelled them out would be a view that can forget one,
	 * and `marks` is the arm nothing else would notice missing — a stale outline survives *for
	 * the life of the view*, which is the guarantee §5.4 exists to give.
	 *
	 * The other three arms are `AssetSelectionStore.applyChange`'s. Nothing here reads them, and
	 * nothing there reads these two.
	 */
	async function applyChange(
		change: AssetLibraryChange,
		queries: AssetLibraryQueryServices,
		indexScanCompleted: () => boolean,
	): Promise<void> {
		// Concurrently: a sidecar batch and a catalogue listing are independent reads of different
		// files, and awaiting the marks first only delays the listing behind whatever the slowest
		// sidecar in the batch costs.
		const work: Promise<void>[] = [];
		if (change.marks.length > 0) work.push(marks.invalidate(change.marks, queries));
		if (change.catalogue) work.push(hydrate(queries, indexScanCompleted));
		await Promise.all(work);
	}

	/** Rebuilds this store to its opening state (ADR-005), invalidating whatever is in flight. */
	function reset(): void {
		latestHydration += 1;
		entries.value = [];
		unreadable.value = [];
		error.value = null;
		status.value = 'idle';
		query.value = '';
		marks.reset();
	}

	return {
		visibleEntries,
		/** §3.6's `54 assets` — the whole catalogue's size, which is the one fact about the
		 *  unfiltered listing anything outside this store needs. */
		total: computed(() => entries.value.length),
		unreadable,
		status,
		error,
		query,
		searching,
		emptyStateKey,
		hydrate,
		applyChange,
		reset,
		markFor: (assetId: AssetId) => marks.markFor(assetId),
		/** The rows now IN the viewport — the whole set, per `ViewportMarks.setVisible`. */
		setVisibleMarks: (assetIds: readonly AssetId[], queries: AssetLibraryQueryServices) =>
			marks.setVisible(assetIds, queries),
		invalidateMarks: (assetIds: readonly AssetId[], queries: AssetLibraryQueryServices) =>
			marks.invalidate(assetIds, queries),
	};
});
