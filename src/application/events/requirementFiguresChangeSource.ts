import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { RequirementId } from '../../domain/requirement/RequirementId';
import { disposeAll, subscribeAll } from './subscriptions';

/**
 * "One requirement's stored figures moved — re-read the rows that show them": the domain
 * event vocabulary, turned into one subscription the Plan Editor's Inspector can take
 * without naming an event.
 *
 * It lives in `application/` for the reason its siblings do, and that reason is the
 * whole point of the indirection: this layer is the one that may know both halves — the
 * `EventBus` port and the event names — so `presentation/` gets a callback and never
 * learns either.
 *
 * **The first two of THREE events, and a `RequirementRecalculated`-only source is silent on
 * exactly the path that needs it most.** `cascade.ts`'s `recalculateOne` persists the stale marker, publishes
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
 * recalculation therefore ALWAYS delivers two of these three events, invalidated then
 * recalculated — reconciling the two is the single-flight loader's job at the consumer, not a
 * reason to pick one — and a third, `CostEstimateChanged`, exactly when the effective cost
 * actually moved (below).
 *
 * **The callback carries the `requirementId` and the CALLER filters**, rather than this
 * module filtering on a project. `RequirementInvalidated`'s payload is `{ requirementId }`
 * with no project in it, so a project filter could not see the failure path at all; and the
 * requirement id is the narrower question anyway, since the Inspector renders the
 * requirements of one selected zone.
 *
 * **THREE events, not two — `CostEstimateChanged` is the one A2 found missing.** A direct
 * `SetRequirementCostOverrideCommand` write calls `publishIfEffectiveCostChanged` and
 * nothing else: it announces `CostEstimateChanged` alone, never `RequirementInvalidated` or
 * `RequirementRecalculated`, because an override is not a recalculation and nothing is
 * "owed" afterwards. So the override path is silent to a source hearing only the first two —
 * correct for the leaf that WROTE the override, since that leaf reads its own write back
 * through the dispatcher's post-command refresh, and wrong for a peer Plan Editor leaf on
 * the same plan, which has no other door onto this requirement's figures moving. Adding it
 * here is also why `requirementIdOf` below reads a second shape: `CostChangePayload` carries
 * no top-level `requirementId` at all.
 */
const REQUIREMENT_FIGURE_EVENTS = [
	'RequirementInvalidated',
	'RequirementRecalculated',
	'CostEstimateChanged',
] as const;

/**
 * `DomainEvent` carries only a `type`. `RequirementInvalidated` and `RequirementRecalculated`
 * add a top-level `requirementId`; `CostEstimateChanged` does not; its id travels inside
 * `CostChangePayload.scope`, which is shared with a later epic's non-requirement scopes
 * (SDD §34) and therefore cannot be a bare `requirementId` field without breaking under that
 * widening. Both shapes are narrowed with a guard rather than a cast, exactly as
 * `planChangeSource.planIdOf` is and for the same reason: an event added to the list WITHOUT
 * either shape is then simply never delivered, instead of handing every listener an
 * `undefined` to filter on — and a scope that is not `'requirement'` (a zone or plan rollup,
 * once that epic lands) declines rather than being read as if `id` were a requirement id.
 */
function requirementIdOf(event: DomainEvent): RequirementId | null {
	const payload = (
		event as {
			payload?: {
				requirementId?: unknown;
				scope?: { kind?: unknown; id?: unknown };
			};
		}
	).payload;
	if (typeof payload?.requirementId === 'string') return payload.requirementId as RequirementId;
	if (payload?.scope?.kind === 'requirement' && typeof payload.scope.id === 'string') {
		return payload.scope.id as RequirementId;
	}
	return null;
}

export function createRequirementFiguresChangeSource(
	events: EventBus,
): (listener: (requirementId: RequirementId) => void) => () => void {
	return (listener: (requirementId: RequirementId) => void) => {
		const subscriptions = subscribeAll(events, REQUIREMENT_FIGURE_EVENTS, (event) => {
			const requirementId = requirementIdOf(event);
			if (requirementId !== null) listener(requirementId);
		});
		return disposeAll(subscriptions);
	};
}
