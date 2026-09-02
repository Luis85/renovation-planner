import type { EventBus } from '../../core/events/EventBus';

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
 * **ONE event, because there is one.** Set, replace and clear all publish
 * `AssetPriceOverrideChanged` — `AssetPriceOverride.events.ts` states that as its own
 * decision ("every subscriber's question is 'this project's price for this asset may have
 * moved'"), so this list is that decision read back rather than a narrowing of a wider
 * vocabulary.
 */
const PRICE_CHANGE_EVENTS = ['AssetPriceOverrideChanged'] as const;

export function createProjectPricesChangeSource(events: EventBus): (listener: () => void) => () => void {
	return (listener: () => void) => {
		const subscriptions = PRICE_CHANGE_EVENTS.map((type) =>
			events.subscribe(type, () => {
				listener();
			}),
		);
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
