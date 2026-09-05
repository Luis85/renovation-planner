import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { ProjectIndexEntryChangedPayload } from './projectIndex.events';

/**
 * "The vault's asset catalogue may have changed — re-read it": the domain event vocabulary,
 * turned into one subscription the Plan Editor's assign picker can take without naming an
 * event.
 *
 * It lives in `application/` for the reason its two siblings do, and that reason is the whole
 * point of the indirection: this layer is the one that may know both halves — the `EventBus`
 * port and the event names — so `presentation/` gets a callback and never learns either.
 *
 * **Why a THIRD source rather than a filter on either existing one.** `createPlanChangeSource`
 * answers "tell me when THIS plan changed" and every caller of it has a plan id to bind; an
 * Asset has belonged to no project since design slice 19 and to no plan ever, so there is no
 * id here to bind and the unfiltered category is the whole of what this caller wants — which
 * is the argument `createProjectListChangeSource` already makes for itself.
 *
 * **What it replaces, and why the borrowing was not simply deleted.** The picker read its
 * options on `onPlanChanged`, which carries six event types. Exactly one of them is this
 * caller's business — `ProjectIndexRebuilt`, and it is load-bearing: Obsidian restores its
 * leaves BEFORE `onLayoutReady`, so the read at mount lands against a still-empty project
 * index and answers an empty catalogue, leaving the picker empty for the life of a restored
 * leaf until something re-reads. The other five — `PlanBackgroundChanged`, `PlanCalibrated`,
 * `ZoneCreated`, `ZoneGeometryChanged`, `ZoneDeleted` — say nothing about the catalogue and
 * re-read every asset note in the vault once per zone gesture. Correct and wasteful; this
 * module is the narrowing.
 */
const CATALOGUE_CHANGE_EVENTS = [
	'ProjectIndexRebuilt',
	'AssetCreated',
	'AssetUpdated',
	'AssetDeleted',
] as const;

/**
 * Events that name ONE index entry, and are this list's business only when that entry is an
 * asset — a SECOND list rather than a hole in the guard below, for the reason
 * `planChangeSource` gives for its own pair: letting an unmatched event through would deliver
 * every future payload-less event to every listener by accident.
 *
 * It is what covers an asset note added by hand, copied in, or arriving through sync.
 * `VaultChangeAdapter` is the sole index writer for those and publishes no domain event of
 * its own, so without this list a synced catalogue entry would reach the index and no picker.
 * The FILTER is what makes it usable rather than merely correct: unfiltered, a burst of synced
 * zone notes would re-read every asset note in the vault, once per note — which is the very
 * cost this module exists to stop paying.
 */
const ASSET_ENTRY_EVENTS = ['ProjectIndexEntryChanged'] as const;

/**
 * `DomainEvent` carries only a `type`. Narrowed with a guard rather than a cast, exactly as
 * `projectListChangeSource.changedEntityTypeOf` is and for the same reason: an event added to
 * the list above WITHOUT this payload is then simply never delivered, instead of comparing
 * `undefined` against an entity type and matching nothing — or, if the comparison were ever
 * inverted, matching everything.
 */
function changedEntityTypeOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload;
	return typeof payload?.entityType === 'string' ? payload.entityType : null;
}

export function createAssetCatalogueChangeSource(events: EventBus): (listener: () => void) => () => void {
	return (listener: () => void) => {
		const subscriptions = [
			// Subscription wiring names different event sets and filters; only the listener forwarding pattern coincides.
			// fallow-ignore-next-line code-duplication
			...CATALOGUE_CHANGE_EVENTS.map((type) =>
				events.subscribe(type, () => {
					listener();
				}),
			),
			...ASSET_ENTRY_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (changedEntityTypeOf(event) === 'renovation-asset') listener();
				}),
			),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
