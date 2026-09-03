import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { AssetEventPayload } from '../../domain/asset/Asset.events';
import type { AssetId } from '../../domain/asset/AssetId';
import type {
	GeometrySidecarChangedPayload,
	ProjectIndexEntryChangedPayload,
	ProjectIndexExclusionChangedPayload,
} from './projectIndex.events';

/**
 * "Keeping a loaded mark honest" (design spec §5.4), turned into one subscription the Asset
 * library can take without naming an event: a cache with no invalidation is a surface that
 * quietly goes stale, and the library holds THREE caches at once — the catalogue listing, a
 * per-asset mark and a per-asset design read — each invalidated by a different, overlapping
 * slice of this vocabulary.
 *
 * **A fourth source, not a widening of `createAssetCatalogueChangeSource`** — §11 item 7's own
 * ruling, made explicit rather than left for this increment to re-decide: the picker shares
 * that source and would pay for any widening of it, re-reading every asset note on a design or
 * geometry event it has no use for. This module answers a different, wider question — "what
 * must the LIBRARY re-read" — and the picker's source is untouched.
 *
 * **The four output sets answer four different consumers, per §5.4/§5.5, and collapsing them
 * loses a real distinction:**
 * - `catalogue` — re-read the whole listing (`ListCatalogueEntries`).
 * - `marks` — drop the cached geometry-outline mark for these ids; the viewport decides when
 *   each is re-read (§5.3's bound), never eagerly.
 * - `design` — the selected asset's `GetAssetDesign` read is stale. Bumps the DESIGN selection
 *   generation alone, never the usage one: §5.5 is explicit that a geometry, height or
 *   background edit must not restart `ListRequirementsReferencing`, a scan of every requirement
 *   in the vault, for every footprint edit a designer leaf makes.
 * - `replaced` — the selected asset's ENTRY was removed or replaced. Bumps BOTH selection
 *   generations, because a ticket has to follow the entry, not only the id naming it: an asset
 *   deleted and recreated under the same id must not let a pre-deletion design or usage answer
 *   populate the replacement.
 *
 * Every subscription list is documented against the neighbour it is not covered by, exactly as
 * `assetDesignChangeSource`'s four lists are — the pattern this module copies rather than
 * re-derives.
 */
export interface AssetLibraryChange {
	/** Re-read the whole catalogue listing. */
	readonly catalogue: boolean;
	/** Drop the cached mark for these ids; the viewport decides when they are re-read. */
	readonly marks: readonly AssetId[];
	/** Ids whose DESIGN read is stale — geometry, height or background moved. Bumps the design
	 *  generation ALONE, never the referencing one. */
	readonly design: readonly AssetId[];
	/** Ids whose ENTRY was removed or replaced. Bumps BOTH selection generations, so a
	 *  pre-deletion design or usage answer cannot populate a same-id replacement. */
	readonly replaced: readonly AssetId[];
}

/** No ids invalidated by this arm — one shared empty array rather than a fresh one per event. */
const NONE: readonly AssetId[] = [];

/**
 * `DomainEvent` carries only a `type`; `AssetCreated`/`AssetUpdated`/`AssetDeleted`/
 * `AssetDesignChanged` all add an `AssetEventPayload`. Narrowed with a guard rather than a
 * cast, exactly as `assetDesignChangeSource.assetIdOf` is, so an event on this list WITHOUT
 * the payload is simply never delivered rather than matching every listener by accident.
 */
function assetIdOf(event: DomainEvent): AssetId | null {
	const payload = (event as { payload?: Partial<AssetEventPayload> }).payload;
	return typeof payload?.assetId === 'string' ? payload.assetId : null;
}

/** The same guard for the index-entry event's own payload, which names a type as well as an id. */
function changedEntry(event: DomainEvent): Partial<ProjectIndexEntryChangedPayload> {
	return (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload ?? {};
}

/**
 * And for the sidecar event's, which names the same two fields about a different subject —
 * two guards rather than one over a shared shape, because a single reader would make the two
 * events interchangeable at exactly the seam that keeps them apart (`assetDesignChangeSource`
 * carries the same pair for the same reason).
 */
function changedSidecar(event: DomainEvent): Partial<GeometrySidecarChangedPayload> {
	return (event as { payload?: Partial<GeometrySidecarChangedPayload> }).payload ?? {};
}

/** And for the exclusion event's, which names a path rather than an entity id — there is no
 *  asset id to invalidate a mark or a selection with, only a listing to re-read. */
function changedExclusion(event: DomainEvent): Partial<ProjectIndexExclusionChangedPayload> {
	return (event as { payload?: Partial<ProjectIndexExclusionChangedPayload> }).payload ?? {};
}

export function createAssetLibraryChangeSource(
	events: EventBus,
): (listener: (change: AssetLibraryChange) => void) => () => void {
	return (listener: (change: AssetLibraryChange) => void) => {
		const subscriptions = [
			/**
			 * `AssetCreated`/`AssetUpdated` — the catalogue changed and nothing else did: neither
			 * touches geometry, so `marks`, `design` and `replaced` all stay empty.
			 */
			...(['AssetCreated', 'AssetUpdated'] as const).map((type) =>
				events.subscribe(type, () => {
					listener({ catalogue: true, marks: NONE, design: NONE, replaced: NONE });
				}),
			),
			/**
			 * `AssetDeleted` invalidates the mark and restarts both selection reads immediately —
			 * NOT made redundant by the listing-diff rule an applied `catalogue` refresh performs,
			 * per §5.4: delete and recreate the same id before that refresh lands and the listing
			 * diff is silent about a gap it never observed, so the event is the load-bearing half.
			 */
			events.subscribe('AssetDeleted', (event) => {
				const assetId = assetIdOf(event);
				if (assetId === null) return;
				listener({ catalogue: true, marks: [assetId], design: NONE, replaced: [assetId] });
			}),
			/**
			 * `AssetDesignChanged` refreshes the CATALOGUE too, not only the mark and the design
			 * read — the arm that is easy to miss, because the event's name says "design".
			 * `SetAssetHeight` and `SetAssetBackground` both write `CatalogueEntryDto` fields and
			 * publish nothing else, and `VaultChangeAdapter`'s echo check means no compensating
			 * index event arrives to cover them. It never lands in `replaced`: a geometry edit
			 * cannot alter which entities reference this asset, so the vault-wide usage scan must
			 * not restart for it.
			 */
			events.subscribe('AssetDesignChanged', (event) => {
				const assetId = assetIdOf(event);
				if (assetId === null) return;
				listener({ catalogue: true, marks: [assetId], design: [assetId], replaced: NONE });
			}),
			/**
			 * `GeometrySidecarChanged` is a SHARED event: `VaultChangeAdapter` raises it for
			 * whatever entry a `.rpgeo` belongs to, so a PLAN's sidecar raises the identical event.
			 * Filtered on `entityType === 'renovation-asset'` exactly as `assetDesignChangeSource`
			 * already does, for the same reason — unfiltered, a plan sidecar edited by hand or
			 * arriving through sync would invalidate the mark and design read of an asset whose id
			 * happens to equal that plan's. Carries no `catalogue`: a sidecar is not in the note.
			 */
			events.subscribe('GeometrySidecarChanged', (event) => {
				const sidecar = changedSidecar(event);
				if (sidecar.entityType !== 'renovation-asset' || typeof sidecar.entityId !== 'string') return;
				const assetId = sidecar.entityId as AssetId;
				listener({ catalogue: false, marks: [assetId], design: [assetId], replaced: NONE });
			}),
			/**
			 * `ProjectIndexEntryChanged`, filtered to `entityType === 'renovation-asset'` for the
			 * reason `assetCatalogueChangeSource` already filters it: unfiltered, a burst of synced
			 * zone notes would clear every mark on screen. It is the ordinary out-of-band case — a
			 * note deleted, recreated or edited outside this plugin's own commands — and it bumps
			 * both selection generations for the reason `AssetDeleted` does: the entry, not only
			 * the id, is what a ticket has to follow.
			 */
			events.subscribe('ProjectIndexEntryChanged', (event) => {
				const entry = changedEntry(event);
				if (entry.entityType !== 'renovation-asset' || typeof entry.entityId !== 'string') return;
				const assetId = entry.entityId as AssetId;
				listener({ catalogue: true, marks: [assetId], design: NONE, replaced: [assetId] });
			}),
			/**
			 * `ProjectIndexRebuilt` carries no payload because a rebuild cannot say which entities
			 * changed, so every listener re-reads the catalogue — the arm a restored leaf depends
			 * on, since Obsidian restores its leaves before `onLayoutReady` and the index scan runs
			 * from it.
			 */
			events.subscribe('ProjectIndexRebuilt', () => {
				listener({ catalogue: true, marks: NONE, design: NONE, replaced: NONE });
			}),
			/**
			 * `ProjectIndexExclusionChanged`, filtered to `entityType === 'renovation-asset'` for
			 * the same reason as the two index-shaped events above: this is a vault-wide event and
			 * an asset's own excluded-notes vocabulary is this surface's only business with it. Its
			 * payload carries a path rather than an entity id — an excluded note has no usable id by
			 * definition — so there is nothing to invalidate a mark or a selection with; only the
			 * listing, which carries the repair strip, needs re-reading.
			 */
			events.subscribe('ProjectIndexExclusionChanged', (event) => {
				const exclusion = changedExclusion(event);
				if (exclusion.entityType !== 'renovation-asset') return;
				listener({ catalogue: true, marks: NONE, design: NONE, replaced: NONE });
			}),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
