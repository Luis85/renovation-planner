import { ref } from 'vue';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetLibraryQueryServices } from '../read-models/assetLibraryQueries';

/**
 * Rule 3 of the design spec's §5.3, and the third of §5.5's three ticket seams, in the one
 * module that owns both — a mark cache bounded by what is ON SCREEN, and a generation per
 * asset so a late answer cannot overwrite a fresh one.
 *
 * §5.3's four rules, and where each lives here:
 * - a mark is requested when its row **enters the viewport, in batches** — `request` takes the
 *   set a caller has just seen enter and issues ONE `listOutlines` for whatever of it is not
 *   already known;
 * - a row **never waits** — nothing here is awaited by a render: `markFor` answers `null` for
 *   an asset nothing has read yet, which is §3.4's *not yet read* state, and the row draws it;
 * - nothing already in flight is **cancelled** when a row leaves, and nothing further is
 *   requested for it — there is no `release` door at all, which is what makes that rule
 *   unbreakable rather than merely observed;
 * - **invalidation drops the cached value and the viewport decides when it is re-read** —
 *   `invalidate` forgets and re-arms, and never issues a read of its own. A row on screen
 *   re-requests on its next viewport pass; a row that is not re-requests when it next enters,
 *   and never before. Reading eagerly here would re-read every asset a burst of synced notes
 *   names, which is the bound this whole seam exists to keep.
 *
 * **There is no timer and no microtask coalescing, and the batch boundary is the CALLER's
 * call.** That is what an `IntersectionObserver` callback already gives — it delivers an array
 * of entries per callback rather than one per row — so a scheduler here would be a second
 * batching mechanism layered over one that already exists, and it would put every test of this
 * module on a hop whose count is a fact about today's implementation. `request` is idempotent
 * against what it already holds, so a caller may hand it the whole visible set on every pass.
 *
 * Not a Pinia store: it holds no cross-view state and needs no devtools identity. It is created
 * by `AssetLibraryStore`, which is what a view actually reaches, and tested through it.
 */
export interface ViewportMarks {
	/** The cached outline, or `null` for §3.4's *not yet read* — never a promise. */
	markFor(assetId: AssetId): AssetOutline | null;
	/** The rows that have just entered the viewport. Already-known and in-flight ids are dropped. */
	request(assetIds: readonly AssetId[], queries: AssetLibraryQueryServices): Promise<void>;
	invalidate(assetIds: readonly AssetId[]): void;
	reset(): void;
}

export function createViewportMarks(): ViewportMarks {
	/**
	 * A `ref` over a real `Map` rather than a plain one: Vue tracks `get`/`set`/`delete` on a
	 * reactive Map, so a row reading `markFor` re-renders when its own id is answered and not
	 * when a neighbour's is — which a whole-map replacement per answer would lose.
	 */
	const marks = ref(new Map<AssetId, AssetOutline>());
	/**
	 * The per-asset ticket. Bumped by `invalidate` alone, so an answer is applied only if the
	 * mark it describes has not been invalidated since the read was issued — successes AND
	 * refusals alike, per §5.5: an old `refused` outline painting §3.4's struck box over a
	 * footprint just read is the same defect wearing the other face.
	 *
	 * A plain `Map` and not reactive: nothing renders a generation.
	 */
	const generations = new Map<AssetId, number>();
	/**
	 * The ids a read is out for. Two roles, and only the first is an optimisation: it stops a
	 * second viewport pass re-reading a sidecar the first pass is already reading, and it is
	 * what `invalidate` clears so an invalidated id can be asked for AGAIN while the answer it
	 * has given up on is still in flight.
	 */
	const inFlight = new Set<AssetId>();

	const generationOf = (assetId: AssetId): number => generations.get(assetId) ?? 0;

	async function request(
		assetIds: readonly AssetId[],
		queries: AssetLibraryQueryServices,
	): Promise<void> {
		const batch = assetIds.filter((assetId) => !marks.value.has(assetId) && !inFlight.has(assetId));
		if (batch.length === 0) return;

		const issued = new Map(batch.map((assetId) => [assetId, generationOf(assetId)]));
		for (const assetId of batch) inFlight.add(assetId);

		const answered = await queries.listOutlines(batch);
		for (const [assetId, outline] of answered) {
			// Two things at once, and deliberately: an id whose generation has moved was
			// invalidated while this read was out, so its answer is dropped AND its in-flight
			// record is left alone — that record belongs to the re-request `invalidate` armed,
			// not to this read. Clearing it here would let this answer's own staleness cancel
			// the fresh read that replaced it.
			if (generationOf(assetId) !== issued.get(assetId)) continue;
			inFlight.delete(assetId);
			marks.value.set(assetId, outline);
		}
	}

	function invalidate(assetIds: readonly AssetId[]): void {
		for (const assetId of assetIds) {
			generations.set(assetId, generationOf(assetId) + 1);
			marks.value.delete(assetId);
			inFlight.delete(assetId);
		}
	}

	return {
		markFor: (assetId) => marks.value.get(assetId) ?? null,
		request,
		invalidate,
		/**
		 * Everything forgotten, in-flight reads included — which is why this bumps rather than
		 * merely clearing: a read still out would otherwise land on the rebuilt cache and
		 * repopulate a mark for a view that has been torn down and reopened.
		 */
		reset(): void {
			invalidate([...inFlight]);
			marks.value = new Map();
		},
	};
}
