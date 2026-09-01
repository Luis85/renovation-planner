import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { AssetEventPayload } from '../../domain/asset/Asset.events';
import type { ProjectIndexEntryChangedPayload } from './projectIndex.events';

/**
 * "Tell me when THIS asset moved" — the domain event vocabulary, turned into one filtered
 * subscription the asset designer can take without naming an event. Its design, and also its
 * existence: see the first list below for why those are one question and not two.
 *
 * It lives in `application/` for the reason its three siblings do, and that reason is the
 * whole point of the indirection: this layer is the one that may know both halves — the
 * `EventBus` port and the event names — so `presentation/` gets a callback and never learns
 * either, which is what stops a view from subscribing to an event type by string and quietly
 * missing the next one added here.
 *
 * **The rule is "this leaf's SUBJECT moved", not "its design did"** — a wider question than the
 * first version of this list asked, and the difference was a defect rather than a nuance. Every
 * design command publishes `AssetDesignChanged`, so a designer heard about every change to what
 * it DRAWS; nothing publishes it for the catalogue's own lifecycle, so `UpdateAssetCommand`
 * renaming an asset left a peer designer showing the old name, and `DeleteAssetCommand` left one
 * drawing an asset the vault no longer has — on which every write it then dispatched refused.
 *
 * That gap was invisible from inside the third list's own argument. Repository-owned writes
 * upsert or remove the index BEFORE the vault event that follows, and `VaultChangeAdapter`'s
 * echo check then declines to announce this plugin's own write — correctly, or a save would cost
 * two refreshes. So no compensating `ProjectIndexEntryChanged` arrives either, and neither list
 * covered those two commands between them.
 *
 * `AssetCreated` is deliberately NOT here, because no leaf can be its subject: a designer is
 * opened FROM an asset that exists, and a restored leaf names an id that existed when the layout
 * was saved. A leaf waiting for its subject to appear is the two index arms' question, below.
 *
 * A per-FIELD list would still be the wrong shape, which is the half of the original argument
 * that survives: it goes stale the day a ninth command is added, silently and in the direction
 * of a stale surface. This list is per-LIFECYCLE, and there are no other lifecycles.
 *
 * It takes an `assetId` like `createPlanChangeSource` does, rather than being unfiltered like
 * the catalogue's: one event per command is affordable exactly because a leaf hears only about
 * the asset it is showing.
 */
const ASSET_SUBJECT_EVENTS = ['AssetDesignChanged', 'AssetUpdated', 'AssetDeleted'] as const;

/**
 * Events that mean "re-read, whichever asset you are showing" — a SECOND list rather than a
 * hole in the filter below, for the reason `planChangeSource` gives for its own pair: letting
 * an unmatched event through would deliver every future payload-less event to every listener
 * by accident.
 *
 * `ProjectIndexRebuilt` carries no payload because a rebuild cannot say which entities
 * changed, and it is the arm a RESTORED leaf depends on. Obsidian restores its leaves before
 * `onLayoutReady` and the index scan runs from it, so the read at mount resolves an asset id
 * against an EMPTY index — `openNoteById` answers `missing`, `GetAssetDesign` refuses with
 * `asset.not-found`, and a designer that heard only about design changes would sit on its
 * failure screen for the life of that leaf. `AssetDesignStore.hydrate` is the other half of
 * that pair: it declines to call a pre-scan miss authoritative, so the leaf holds its loading
 * line rather than flashing a failure this event then retracts.
 */
const EVERY_ASSET_EVENTS = ['ProjectIndexRebuilt'] as const;

/**
 * Events that name ONE index entry, and are this source's business only when that entry is
 * this leaf's own asset — a THIRD list, and the same narrowing `assetCatalogueChangeSource`
 * makes for the picker.
 *
 * It is what covers an asset note added by hand, copied in, or arriving through sync:
 * `VaultChangeAdapter` is the sole index writer for those and publishes no domain event of its
 * own, so without it a synced height edit reaches the index and no designer. This plugin's own
 * writes are not announced here — the adapter's echo check comes first — so a save costs one
 * refresh through `AssetDesignChanged`, not two.
 *
 * **What it does NOT cover, stated rather than implied:** the geometry SIDECAR is not a note
 * and carries no index entry of its own, so a `.rpasset` arriving through sync reaches this
 * source through nothing. That is the same gap `planChangeSource` has for a plan's sidecar,
 * and closing it is a change to the vault-change pipeline rather than to this module.
 */
const ASSET_ENTRY_EVENTS = ['ProjectIndexEntryChanged'] as const;

/**
 * `DomainEvent` carries only a `type`; every event in the first list adds an
 * `AssetEventPayload`. Narrowed with a guard rather than a cast so that an event added to that
 * list WITHOUT the payload is simply never delivered, instead of comparing `undefined` against
 * an asset id and matching whichever leaf also has none.
 */
function assetIdOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<AssetEventPayload> }).payload;
	return typeof payload?.assetId === 'string' ? payload.assetId : null;
}

/** The same guard for the entry event's own payload, which names a type as well as an id. */
function changedEntry(event: DomainEvent): Partial<ProjectIndexEntryChangedPayload> {
	return (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload ?? {};
}

export function createAssetDesignChangeSource(
	events: EventBus,
): (assetId: string, listener: () => void) => () => void {
	return (assetId: string, listener: () => void) => {
		const subscriptions = [
			...ASSET_SUBJECT_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (assetIdOf(event) === assetId) listener();
				}),
			),
			...EVERY_ASSET_EVENTS.map((type) => events.subscribe(type, () => listener())),
			...ASSET_ENTRY_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					const entry = changedEntry(event);
					if (entry.entityType === 'renovation-asset' && entry.entityId === assetId) listener();
				}),
			),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
