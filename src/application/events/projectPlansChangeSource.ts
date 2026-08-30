import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { PlanEventPayload } from '../../domain/plan/Plan.events';
import type { ProjectIndexEntryChangedPayload } from './projectIndex.events';

/**
 * "Some plan of THIS project changed, from anywhere" — design slice 21's third change source.
 *
 * It lives in `application/` for the reason its two siblings do, and that reason is the whole
 * point of the indirection: this layer is the one that may know both halves — the `EventBus`
 * port and the event names — so `presentation/` gets a callback and never learns either.
 *
 * **Why a THIRD source rather than a filter on one of the two.** `createPlanChangeSource`
 * answers "tell me when THIS plan changed" and every caller binds a plan id; this view has
 * none, it has a PROJECT. `createProjectListChangeSource` answers "the set of projects
 * changed" and is unfiltered; delivering that here would re-read one project's plans for
 * every project note in the vault. The question asked here is narrower than the first and
 * wider than the second.
 *
 * The LIST is the extension point — a name added here, never a second refresh path in the
 * view.
 */
const PROJECT_PLAN_EVENTS = ['PlanCreated'] as const;

/**
 * Events that name ONE index entry, and are this project's business when that entry is a
 * plan — a SECOND list rather than a hole in the guard below, for the reason
 * `planChangeSource` gives for its own pair: letting an unmatched event through would deliver
 * every future payload-less event to every listener by accident.
 *
 * **This arm cannot be filtered by project, and that is a stated cost rather than an
 * oversight.** `ProjectIndexEntryChangedPayload` carries `entityId` and `entityType` and no
 * owning project — measured — so it fires for a change to any plan note in the vault and this
 * one leaf re-reads one project's plans. Affordable exactly because the view is a singleton
 * and the query is project-scoped, which is what makes it different from the "once per synced
 * zone note" the project list's own filter exists to avoid.
 * *Trigger to narrow it: that payload gaining the owning project id.*
 */
const PLAN_ENTRY_EVENTS = ['ProjectIndexEntryChanged'] as const;

/**
 * `DomainEvent` carries only a `type`. Narrowed with a guard rather than a cast, exactly as
 * `planChangeSource.planIdOf` is: an event added to a list above WITHOUT the payload it
 * expects is then simply never delivered, instead of comparing `undefined` against an id and
 * matching whichever listener also has none.
 */
function projectIdOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<PlanEventPayload> }).payload;
	return typeof payload?.projectId === 'string' ? payload.projectId : null;
}

function changedEntityTypeOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload;
	return typeof payload?.entityType === 'string' ? payload.entityType : null;
}

export function createProjectPlansChangeSource(
	events: EventBus,
): (projectId: string, listener: () => void) => () => void {
	return (projectId: string, listener: () => void) => {
		const subscriptions = [
			...PROJECT_PLAN_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (projectIdOf(event) === projectId) listener();
				}),
			),
			...PLAN_ENTRY_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (changedEntityTypeOf(event) === 'renovation-plan') listener();
				}),
			),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
