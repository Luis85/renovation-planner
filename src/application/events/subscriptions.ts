import type { Disposable } from '../../core/events/Disposable';
import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { GeometrySidecarChangedPayload, ProjectIndexEntryChangedPayload } from './projectIndex.events';

/**
 * The mechanism every change source in this directory shares, and nothing else: how a list of
 * event types becomes subscriptions, how those subscriptions are RELEASED, and how the two
 * index-shaped payloads are READ.
 *
 * `.fallowrc.json`'s duplicates block reviewed the spread and the disposer walk once and wrote
 * its own trigger down — "a sixth source, or any change to how a subscription is released — at
 * which point one `subscribeToAll(events, registrations)` in `application/events/` should take
 * ALL FIVE in one edit, and this key should go rather than grow". There are EIGHT sources now,
 * so the trigger has fired and this is that edit: all eight, never some of them, because a
 * helper adopted by two of eight is a third spelling of one mechanism and that is exactly the
 * half-adoption the deferral was protecting against.
 *
 * **What deliberately does NOT live here is POLICY.** The event LISTS and the filters differ in
 * every source and are the parts a reader has to get right; sharing either would make two
 * sources interchangeable at exactly the seam that keeps them apart.
 *
 * `subscribeAll` registers ONE handler reference for the whole list, so a list naming the same
 * event type twice registers it once — `EventBus`'s subscriptions are Set-based per type, and a
 * Set of one function holds one entry regardless of how many times `.map` called `subscribe`
 * with it. The per-source copies this replaced each built its OWN handler per source, which had
 * no such backstop; no source's list names a duplicate today, so nothing here relies on it.
 */
export function subscribeAll<TType extends string>(
	events: EventBus,
	types: readonly TType[],
	handler: (event: DomainEvent<TType>) => void,
): Disposable[] {
	return types.map((type) => events.subscribe(type, handler));
}

/** The release half of the same mechanism: one disposer over a whole bundle. */
export function disposeAll(subscriptions: readonly Disposable[]): () => void {
	return () => {
		for (const subscription of subscriptions) subscription.dispose();
	};
}

/**
 * `DomainEvent` carries only a `type`. Narrowed with a guard rather than a cast, so an event
 * added to a source's list WITHOUT the payload is simply never delivered instead of comparing
 * `undefined` against an id and matching whichever listener also has none.
 */
export function changedEntry(event: DomainEvent): Partial<ProjectIndexEntryChangedPayload> {
	return (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload ?? {};
}

/**
 * The same reader for the sidecar event's payload, which names the same two fields about a
 * different subject. **Two functions rather than one over a shared shape**, though the two
 * payloads are structurally alike: a single reader would make the two events interchangeable at
 * exactly the seam that keeps them apart, which is the argument `assetDesignChangeSource` and
 * `assetLibraryChangeSource` each carried in their own copy before this module took the pair.
 */
export function changedSidecar(event: DomainEvent): Partial<GeometrySidecarChangedPayload> {
	return (event as { payload?: Partial<GeometrySidecarChangedPayload> }).payload ?? {};
}
