import type { Disposable } from './Disposable';

/**
 * The only event shape `core/events/` knows (SDD §33): a discriminant `type`, nothing
 * else. Concrete domain events (`ProjectCreated`, `ZoneGeometryChanged`, …, §34) extend
 * this with their own literal type and payload fields beside their owning entity — this
 * module never imports them.
 */
export interface DomainEvent<TType extends string = string> {
	readonly type: TType;
}

type Subscriber = (event: DomainEvent) => void | Promise<void>;

/**
 * The in-process pub/sub bus (SDD §33). Decisions the SDD leaves open, made here:
 *
 * - `publish` is Promise-aware and AWAITS its handlers: the §32 event chain implies
 *   handlers that do real recalculation work, which may be asynchronous. A publisher that
 *   needs fire-and-forget can ignore the returned promise. The cost of that shape is one
 *   microtask hop per delivery even for a synchronous handler — deliberate, and worth
 *   revisiting only if slice 3's recalculation chain ever shows up in a profile.
 * - One handler's failure is isolated at BOTH layers: a throwing handler neither prevents
 *   sibling subscribers from running nor rejects the `publish` call itself — events are
 *   published after a successful state change (§32), so a subscriber throwing must not
 *   look like the command failed. Each failure is handed to the `onError` callback the
 *   bus was built with, which is where the logging pipeline (slice 11) picks it up; and
 *   if THAT callback throws, the throw is swallowed, because a faulty logger turning a
 *   handled failure back into a command failure would be the isolation bug again, one
 *   layer up. `core/` cannot log by itself — a pure module has no side channel to report
 *   through.
 *
 * Two further semantics, deliberate and pinned by tests:
 *
 * - Subscriptions are SET-based: registering the same handler function twice under one
 *   event type registers it once, and a single `dispose` removes it entirely.
 * - Delivery iterates a SNAPSHOT of the handler list taken when `publish` starts, so
 *   subscribing or disposing during a dispatch never affects the dispatch in flight.
 */
export interface EventBus {
	publish<E extends DomainEvent>(event: E): Promise<void>;
	subscribe<TType extends string>(
		type: TType,
		handler: (event: DomainEvent<TType>) => void | Promise<void>,
	): Disposable;
}

/**
 * Builds the one bus instance the composition root holds. `onError` receives every
 * handler rejection together with the event it happened while delivering; passing none
 * keeps the bus silent — a failure then vanishes, so callers are expected to wire one as
 * soon as a logger exists.
 */
export function createEventBus(
	onError?: (error: unknown, event: DomainEvent) => void,
): EventBus {
	const subscribers = new Map<string, Set<Subscriber>>();

	function deliver(handler: Subscriber, event: DomainEvent): Promise<void> {
		return Promise.resolve()
			.then(() => handler(event))
			.catch((error: unknown) => {
				try {
					onError?.(error, event);
				} catch {
					// Swallowed deliberately: see "isolated at BOTH layers" above.
				}
			});
	}

	return {
		publish<E extends DomainEvent>(event: E): Promise<void> {
			const handlers = subscribers.get(event.type);
			if (!handlers || handlers.size === 0) {
				return Promise.resolve();
			}
			const settled = [...handlers].map((handler) => deliver(handler, event));
			return Promise.all(settled).then(() => undefined);
		},

		subscribe<TType extends string>(
			type: TType,
			handler: (event: DomainEvent<TType>) => void | Promise<void>,
		): Disposable {
			let set = subscribers.get(type);
			if (!set) {
				set = new Set();
				subscribers.set(type, set);
			}
			set.add(handler as Subscriber);

			return {
				dispose(): void {
					set.delete(handler as Subscriber);
					if (set.size === 0 && subscribers.get(type) === set) {
						subscribers.delete(type);
					}
				},
			};
		},
	};
}
