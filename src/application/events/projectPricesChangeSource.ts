import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { ProjectIndexEntryChangedPayload } from './projectIndex.events';

/**
 * "A project's own price for some asset may have moved — re-read it": the domain event
 * vocabulary, turned into one subscription a view can take without naming an event.
 *
 * It lives in `application/` for the reason its siblings do: this layer may know both the
 * `EventBus` port and the event names, so `presentation/` gets a callback and learns
 * neither.
 *
 * **UNFILTERED, which is a decision about the CALLER rather than about the event.**
 * `AssetPriceOverrideChanged` carries both a `projectId` and an `assetId`, so a filtered
 * variant is expressible — and the Plan Editor, which is this module's first caller, holds
 * neither id: its context is a PLAN, and resolving that plan to a project is an async read
 * this subscription would have to wait on before it could decide to skip work. The
 * unfiltered category is what that caller wants, exactly as `assetCatalogueChangeSource`
 * argues for itself; a caller that does hold a project id narrows at its own end, where the
 * id already is.
 *
 * **ONE domain event, because there is one.** Set, replace and clear all publish
 * `AssetPriceOverrideChanged` — `AssetPriceOverride.events.ts` states that as its own
 * decision ("every subscriber's question is 'this project's price for this asset may have
 * moved'"), so this list is that decision read back rather than a narrowing of a wider
 * vocabulary.
 */
const PRICE_CHANGE_EVENTS = ['AssetPriceOverrideChanged'] as const;

/**
 * Events that name ONE index entry, and are this list's business only when that entry is a
 * price override — a SECOND list rather than a hole in the guard below, for the reason
 * `assetCatalogueChangeSource` and `planChangeSource` both give: letting an unmatched event
 * through would deliver every future payload-less event to every listener by accident.
 *
 * **This is the half no COMMAND can raise, and the list above is silent on it.** A price
 * override note edited by hand, copied in, arriving through sync, or deleted outside the two
 * commands publishes no domain event at all — `VaultChangeAdapter` is the SOLE index writer
 * for those, and what it announces is this. Without this list a mounted Inspector shows the
 * previous project price, and the provenance beside it, for the life of the leaf; the docblock
 * above says "ONE event" of the DOMAIN vocabulary, and that was read as an answer to a
 * question it was not being asked. Design slice 16 records the identical gap for the project
 * list ("the half of a staleness that no COMMAND can raise"), and this is that lesson applied
 * in the module written to carry it.
 *
 * The FILTER is what makes it usable rather than merely correct: unfiltered, a burst of synced
 * zone notes would re-read one selected zone's requirements once per note.
 */
const PRICE_ENTRY_EVENTS = ['ProjectIndexEntryChanged'] as const;

/**
 * `DomainEvent` carries only a `type`. Narrowed with a guard rather than a cast, exactly as
 * `assetCatalogueChangeSource.changedEntityTypeOf` is and for the same reason: an event added
 * to the list above WITHOUT this payload is then simply never delivered, instead of comparing
 * `undefined` against an entity type and matching nothing — or, if the comparison were ever
 * inverted, matching everything.
 */
function changedEntityTypeOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload;
	return typeof payload?.entityType === 'string' ? payload.entityType : null;
}

export function createProjectPricesChangeSource(events: EventBus): (listener: () => void) => () => void {
	return (listener: () => void) => {
		const subscriptions = [
			...PRICE_CHANGE_EVENTS.map((type) =>
				events.subscribe(type, () => {
					listener();
				}),
			),
			...PRICE_ENTRY_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (changedEntityTypeOf(event) === 'renovation-asset-price') listener();
				}),
			),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
