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

/**
 * How far this library got reading its catalogue.
 *
 * `failed` is distinct from `ready` for the reason `RenovationProjectStore` keeps them apart:
 * `emptyStateKey` below is structurally unreachable from it rather than merely unreached, so a
 * vault that could not be read can never draw *no assets yet*.
 */
type AssetLibraryStatus = 'idle' | 'loading' | 'ready' | 'failed';

/**
 * The Asset library's working copy of the catalogue listing and of every mark on screen —
 * never a write path, exactly like every other store here: nothing calls a repository, and
 * everything is rebuildable by re-running the two queries (ADR-005).
 *
 * TWO of §5.5's three ticket seams live here and they are different questions, which is why
 * they are two mechanisms rather than one counter:
 * - the LISTING is ticketed on the view — one counter, latest wins — because it is refreshed
 *   by events rather than by a gesture, so two arriving close together is the ordinary case;
 * - a MARK is ticketed per asset, in `viewportMarks.ts`, because invalidation names ids.
 *
 * The third seam, the selection reads, is `AssetSelectionStore`'s: a store per lifetime rather
 * than one store holding three, since the whole point of §5.5 is that the three are restarted
 * by different things.
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
	 * Whether a search is running — the one input `selectAssetLibraryEmptyState` takes that is
	 * not part of the listing, and one it cannot derive: an empty list with a query running is
	 * *no matches*, and without one it is *no assets*, which want opposite copy and opposite
	 * actions. Held here rather than passed to the getter so `emptyStateKey` stays a PROPERTY,
	 * matching its three siblings; the search field itself is the root's, and it writes this.
	 */
	const searching = ref(false);
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
	 * **`indexScanCompleted` is asked AFTER the read and never before**, and it is asked rather
	 * than captured. Obsidian restores its leaves before `onLayoutReady` and the index scan runs
	 * from it, so `listAll()` enumerates an EMPTY index and answers a perfectly legitimate
	 * `ok([])` — which a view mapping to §4's Empty row draws as *no assets yet* with a `New
	 * asset` button under it, and a renovator who takes that invitation defines the duplicate
	 * this whole feature exists to prevent. The question is whether the scan RAN, never whether
	 * it FOUND anything: "is the index populated" hangs a restored pane for ever in a vault
	 * whose last asset note was deleted while Obsidian was closed.
	 *
	 * Asked after the read because the two must describe the same moment: a scan that completed
	 * WHILE the read was out makes that read authoritative, and a gate asked first would hold
	 * `loading` until some later event happened to arrive. The read it costs is one, on a path
	 * `ProjectIndexRebuilt` re-runs anyway.
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

		if (status.value !== 'ready') status.value = 'loading';
		error.value = null;

		const found = await queries.listCatalogue();
		if (superseded()) return;
		if (isErr(found)) {
			fail(found.error);
			return;
		}
		if (!indexScanCompleted()) {
			status.value = 'loading';
			return;
		}

		entries.value = found.value.entries;
		unreadable.value = found.value.unreadable;
		status.value = 'ready';
	}

	/**
	 * Which empty state this library is in, or `null` for a normal render.
	 *
	 * Guarded by `status === 'ready'` for the structural reason its three siblings are, and it
	 * passes the REAL unreadable count rather than a zero: `selectAssetLibraryEmptyState`'s
	 * first statement refuses unconditionally on `unreadable > 0`, and a getter that fed it `0`
	 * would reintroduce the exact defect that guard exists for — inviting a user to create their
	 * first asset over a catalogue full of notes this build could not parse.
	 */
	const emptyStateKey = computed(() =>
		status.value === 'ready'
			? selectAssetLibraryEmptyState(entries.value, unreadable.value.length, searching.value)
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
		if (change.marks.length > 0) marks.invalidate(change.marks);
		if (change.catalogue) await hydrate(queries, indexScanCompleted);
	}

	/** Rebuilds this store to its opening state (ADR-005), invalidating whatever is in flight. */
	function reset(): void {
		latestHydration += 1;
		entries.value = [];
		unreadable.value = [];
		error.value = null;
		status.value = 'idle';
		marks.reset();
	}

	return {
		entries,
		unreadable,
		status,
		error,
		searching,
		emptyStateKey,
		hydrate,
		applyChange,
		reset,
		markFor: (assetId: AssetId) => marks.markFor(assetId),
		requestMarks: (assetIds: readonly AssetId[], queries: AssetLibraryQueryServices) =>
			marks.request(assetIds, queries),
		invalidateMarks: (assetIds: readonly AssetId[]) => marks.invalidate(assetIds),
	};
});
