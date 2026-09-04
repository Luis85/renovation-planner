import { ref } from 'vue';
import type { AssetOutline } from '../../application/queries/ListAssetOutlines';
import type { AssetId } from '../../domain/asset/AssetId';
import type { AssetLibraryQueryServices } from '../read-models/assetLibraryQueries';

/**
 * Rule 3 of the design spec's §5.3 and the invalidation half of §5.4, in the one module that
 * owns both — a mark cache bounded by WHAT THE CALLER SAYS IS ON SCREEN, and a generation per
 * asset so a late answer cannot overwrite a fresh one.
 *
 * **WHAT THE SHIPPED CALLER ACTUALLY SAYS, first, because everything below is written in
 * §5.3's vocabulary and that vocabulary promises more than this surface delivers.** §5.3's own
 * bound is the VIEWPORT. Nothing in this repository observes one: **nothing here constructs an
 * `IntersectionObserver`** — every occurrence of that name in `src/` and `tests/` is prose,
 * this paragraph and `AssetLibraryBody.vue`'s own included, which is why that is stated as a
 * thing rather than as a count, since a grep for a name quoted inside a file that discusses it
 * counts itself. jsdom implements none either, so an observer would be this tree's first AND
 * unexercisable by the suite as it stands. What Task 17b wired instead is
 * `AssetLibraryBody.drawnAssetIds` — every row an OPEN SHELF draws, or every match when §6.1's
 * flat Results list has replaced the shelves — which is a strict SUPERSET of the viewport.
 *
 * So read every *viewport*, *on screen* and *visible* below as **DRAWN**: the names here are
 * §5.3's and are kept, the bound they carry today is the caller's, and `AssetLibraryBody.vue`
 * is where that narrowing and its cost are argued. **This paragraph LEADS the file for a
 * measured reason rather than a stylistic one**: it followed four sentences that contradicted
 * it for one commit, and those sentences were vacuous while nothing called this door and became
 * live over-claims the moment a caller existed. A comment can be made false by a diff that does
 * not touch it. Nothing in this module changes if an observer ever arrives — it would call
 * `setVisible` with a smaller set.
 *
 * §5.3's rules, and where each lives here:
 * - a mark is requested when its row **enters the viewport, in batches** — which is §5.3's
 *   sentence; here, `setVisible` takes the set the caller says is drawn and issues ONE
 *   `listOutlines` for whatever of it is not already known;
 * - a row **never waits** — nothing here is awaited by a render: `markFor` answers `null` for
 *   an asset nothing has read yet, which is §3.4's *not yet read* state, and the row draws it;
 * - nothing already in flight is **cancelled** when a row leaves, and nothing further is
 *   requested for it — there is no cancellation door at all, which makes that rule unbreakable
 *   rather than merely observed.
 *
 * **§5.4's own sentence is the reason this module remembers what is drawn at all**: *"A row on
 * screen re-requests IMMEDIATELY; a row that is not … re-requests when it next enters the
 * viewport, and never before."* No further pass is coming for a row that never leaves — the
 * shipped caller re-issues `setVisible` only when its own set CHANGES, and an observer would
 * fire no callback either — so a design in `invalidate` that merely forgot the value and waited
 * for "the next pass" would blank a drawn mark to *not yet read* and leave it there until the
 * user closed the shelf and reopened it: for the life of the view, which is the exact guarantee
 * §5.4 exists to give. Reading eagerly for EVERY invalidated id is the opposite error: a burst
 * of synced notes would read every sidecar it names. So the drawn set is held here and
 * `invalidate` re-requests exactly its intersection with it, which is a fact the caller already
 * has to supply for `setVisible` and would otherwise have to remember to supply twice.
 *
 * **There is no timer and no microtask coalescing, and the batch boundary is the CALLER's
 * call.** A scheduler here would be a second batching mechanism layered over the caller's own,
 * and it would put every test of this module on a hop count that is a fact about today's
 * implementation. `setVisible` is idempotent against what it already holds and against what is
 * in flight, so it is called with the whole drawn set on every pass.
 *
 * Not a Pinia store: it holds no cross-view state and needs no devtools identity. It is created
 * by `AssetLibraryStore`, which is what a view actually reaches, and tested through it.
 */
export interface ViewportMarks {
	/** The cached outline, or `null` for §3.4's *not yet read* — never a promise. */
	markFor(assetId: AssetId): AssetOutline | null;
	/**
	 * The rows the caller is now DRAWING — the whole set, not the ones that just entered, and
	 * *drawn* rather than *in the viewport* per this module's leading paragraph. Unknown ids are
	 * read in one batch; known and in-flight ones are dropped; the set is remembered, because it
	 * is what decides which invalidated marks re-read at once.
	 */
	setVisible(assetIds: readonly AssetId[], queries: AssetLibraryQueryServices): Promise<void>;
	/** Forget these marks, and re-read at once exactly the ones a row is currently drawing. */
	invalidate(assetIds: readonly AssetId[], queries: AssetLibraryQueryServices): Promise<void>;
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
	/**
	 * What the caller last said was visible — §5.4's *immediately* is a question about this set
	 * and nothing else. Today that is what an open shelf DRAWS rather than what a viewport shows;
	 * see this module's header.
	 */
	let visible: ReadonlySet<AssetId> = new Set();

	const generationOf = (assetId: AssetId): number => generations.get(assetId) ?? 0;

	async function read(
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

	function forget(assetIds: readonly AssetId[]): void {
		for (const assetId of assetIds) {
			generations.set(assetId, generationOf(assetId) + 1);
			marks.value.delete(assetId);
			inFlight.delete(assetId);
		}
	}

	return {
		markFor: (assetId) => marks.value.get(assetId) ?? null,

		setVisible(assetIds, queries) {
			visible = new Set(assetIds);
			return read(assetIds, queries);
		},

		invalidate(assetIds, queries) {
			forget(assetIds);
			return read(
				assetIds.filter((assetId) => visible.has(assetId)),
				queries,
			);
		},

		/**
		 * Everything forgotten, in-flight reads included — which is why this bumps rather than
		 * merely clearing: a read still out would otherwise land on the rebuilt cache and
		 * repopulate a mark for a view that has been torn down and reopened. The visible set goes
		 * with it, so nothing re-reads on the way down.
		 */
		reset(): void {
			visible = new Set();
			forget([...inFlight]);
			marks.value = new Map();
		},
	};
}
