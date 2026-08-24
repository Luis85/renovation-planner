import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { PlanEventPayload } from '../../domain/plan/Plan.events';

/**
 * "Tell me when THIS Plan changed" — the domain event vocabulary, turned into one filtered
 * subscription.
 *
 * It lives in `application/` because that is the layer that may know both halves: the
 * `EventBus` port and the names of the Plan events. `presentation/` gets a callback and
 * never learns either, which is what stops a view from subscribing to an event type by
 * string and quietly missing the next one added here.
 *
 * The LIST is the extension point. Slice 7 adds calibration's own re-render this way and
 * slice 8 adds the zone events, each by naming an event here rather than by giving the
 * Plan Editor a second refresh path.
 */
const PLAN_CHANGE_EVENTS = ['PlanBackgroundChanged', 'PlanCalibrated'] as const;

/**
 * Events that mean "re-read, whichever plan you are showing" — a SECOND list rather than a
 * hole in the filter below.
 *
 * `ProjectIndexRebuilt` carries no plan id because a rebuild says nothing about which
 * entities changed, so it cannot be matched against a leaf's plan and must reach every
 * leaf. Handling that by letting an unmatched event through would have delivered every
 * future payload-less event to every listener by accident; naming the category is what
 * makes "applies to all plans" a decision instead of a side effect of the guard.
 */
const EVERY_PLAN_EVENTS = ['ProjectIndexRebuilt'] as const;

/**
 * `DomainEvent` carries only a `type`; every event in the list above adds a
 * `PlanEventPayload`. Narrowed with a guard rather than a cast so that an event added to
 * the list WITHOUT that payload is simply never delivered, instead of comparing
 * `undefined` against a plan id and matching whichever leaf also has none.
 */
function planIdOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<PlanEventPayload> }).payload;
	return typeof payload?.planId === 'string' ? payload.planId : null;
}

export function createPlanChangeSource(
	events: EventBus,
): (planId: string, listener: () => void) => () => void {
	return (planId: string, listener: () => void) => {
		const subscriptions = [
			...PLAN_CHANGE_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (planIdOf(event) === planId) listener();
				}),
			),
			...EVERY_PLAN_EVENTS.map((type) => events.subscribe(type, () => listener())),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
