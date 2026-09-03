import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { RequirementId } from '../../domain/requirement/RequirementId';

/**
 * "One requirement's stored figures moved — re-read the rows that show them": the domain
 * event vocabulary, turned into one subscription the Plan Editor's Inspector can take
 * without naming an event.
 *
 * It lives in `application/` for the reason its three siblings do, and that reason is the
 * whole point of the indirection: this layer is the one that may know both halves — the
 * `EventBus` port and the event names — so `presentation/` gets a callback and never
 * learns either.
 *
 * **TWO events, and a `RequirementRecalculated`-only source is silent on exactly the path
 * that needs it most.** `cascade.ts`'s `recalculateOne` persists the stale marker, publishes
 * `RequirementInvalidated`, then recalculates — and on a recalculation FAILURE it publishes
 * nothing at all, deliberately, under a comment saying `RequirementRecalculated` "would
 * misrepresent what happened". So after a failed recalculation the durable status is `stale`
 * and the only event that followed the write was the invalidation. A source hearing
 * recalculations alone leaves a mounted Inspector rendering that row as `current`
 * indefinitely — and neither the price nor the catalogue source covers it, because both are
 * concurrent SIBLINGS of the cascade and can finish before `markStale` lands.
 *
 * `RequirementInvalidated`'s own docblock calls it transient and "not persisted", which is
 * true of the EVENT and not of the moment it is published: the cascade publishes it AFTER
 * the marker is written, so a listener reading then reads the marker. A successful
 * recalculation therefore delivers two events, invalidated then recalculated — which is the
 * single-flight loader's job at the consumer, not a reason to pick one.
 *
 * **The callback carries the `requirementId` and the CALLER filters**, rather than this
 * module filtering on a project. `RequirementInvalidated`'s payload is `{ requirementId }`
 * with no project in it, so a project filter could not see the failure path at all; and the
 * requirement id is the narrower question anyway, since the Inspector renders the
 * requirements of one selected zone.
 */
const REQUIREMENT_FIGURE_EVENTS = ['RequirementInvalidated', 'RequirementRecalculated'] as const;

/**
 * `DomainEvent` carries only a `type`; both events above add a `requirementId`. Narrowed
 * with a guard rather than a cast, exactly as `planChangeSource.planIdOf` is and for the
 * same reason: an event added to the list WITHOUT that field is then simply never
 * delivered, instead of handing every listener an `undefined` to filter on.
 */
function requirementIdOf(event: DomainEvent): RequirementId | null {
	const payload = (event as { payload?: { requirementId?: unknown } }).payload;
	return typeof payload?.requirementId === 'string' ? (payload.requirementId as RequirementId) : null;
}

export function createRequirementFiguresChangeSource(
	events: EventBus,
): (listener: (requirementId: RequirementId) => void) => () => void {
	return (listener: (requirementId: RequirementId) => void) => {
		const subscriptions = REQUIREMENT_FIGURE_EVENTS.map((type) =>
			events.subscribe(type, (event) => {
				const requirementId = requirementIdOf(event);
				if (requirementId !== null) listener(requirementId);
			}),
		);
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
