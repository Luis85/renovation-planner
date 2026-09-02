import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { PlanEventPayload } from '../../domain/plan/Plan.events';
import type { GeometrySidecarChangedPayload } from './projectIndex.events';

/**
 * "Tell me when THIS Plan changed" — the domain event vocabulary, turned into one filtered
 * subscription.
 *
 * It lives in `application/` because that is the layer that may know both halves: the
 * `EventBus` port and the names of the Plan events. `presentation/` gets a callback and
 * never learns either, which is what stops a view from subscribing to an event type by
 * string and quietly missing the next one added here.
 *
 * The LIST is the extension point: an event is delivered to a plan's leaves by being
 * named here, rather than by giving the Plan Editor a second refresh path.
 *
 * **The zone events are on it, and slice 8's own refresh decorator is not a substitute.**
 * That decorator re-reads the leaf whose dispatcher ran — which is every leaf, as long as
 * nothing else can change a zone. Two things can: a second Plan Editor leaf on the same
 * plan (`revealPlanEditor` reuses an existing one, but Obsidian's own "split" duplicates a
 * leaf with its view state intact), and any write from outside the editor — the sample
 * seed, a synced note, a later slice's Bases view. Without these three the second leaf
 * drew a stale zone set indefinitely and hit-tested against zones that no longer existed.
 * The dispatching leaf pays one redundant re-read for it, which is a cost, not a defect.
 */
const PLAN_CHANGE_EVENTS = [
	'PlanBackgroundChanged',
	'PlanCalibrated',
	'ZoneCreated',
	'ZoneGeometryChanged',
	'ZoneDeleted',
] as const;

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
 * The plan's own geometry SIDECAR changed on disk out of band — a THIRD list, and a separate
 * one for the reason the pair above give for being two: it carries a different payload, so
 * letting it through the plan-id filter would compare an `undefined` plan id, and letting it
 * through the unfiltered arm would re-read every open editor for a sidecar belonging to some
 * other plan.
 *
 * **It is the one arm that covers a plan's ZONES arriving from outside this plugin.** A `.rpgeo`
 * is where they live (ADR-011), and it is not a note: sync, a hand edit or the file explorer
 * touching one raises none of the five domain events above, and `VaultChangeAdapter` reads the
 * document at no point, so it cannot honestly publish `ZoneGeometryChanged` for it either. The
 * index side of that path moves a MAPPING at most — announced as `ProjectIndexEntryChanged`,
 * which this source deliberately does not subscribe to, since a plan note retyped or reindexed
 * is a different question from its geometry moving. Without this arm the canvas drew the zone
 * set it read at mount indefinitely and hit-tested against zones the vault no longer had.
 *
 * Filtered on the TYPE as well as the id, because a plan's sidecar and an asset's are the same
 * file type under two owners (ADR-0014) and the id alone does not say which.
 */
const PLAN_SIDECAR_EVENTS = ['GeometrySidecarChanged'] as const;

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

/**
 * The same narrowing for the sidecar event's own payload, which names an entity TYPE as well as
 * an id. A separate guard rather than a widened `planIdOf`, because these are two payload shapes
 * and one function reading both would have to accept a partial of either.
 */
function changedSidecar(event: DomainEvent): Partial<GeometrySidecarChangedPayload> {
	return (event as { payload?: Partial<GeometrySidecarChangedPayload> }).payload ?? {};
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
			...PLAN_SIDECAR_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					const sidecar = changedSidecar(event);
					if (sidecar.entityType === 'renovation-plan' && sidecar.entityId === planId) listener();
				}),
			),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
