import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { ProjectIndexEntryChangedPayload } from './projectIndex.events';

/**
 * "The set of projects may have changed — re-read it": the domain event vocabulary, turned
 * into one subscription the Renovation Project view can take without naming an event.
 *
 * It lives in `application/` for the same reason `planChangeSource` does, and that reason is
 * the whole point of the indirection: this layer is the one that may know both halves — the
 * `EventBus` port and the event names — so `presentation/` gets a callback and never learns
 * either. A view subscribing by string is a view that quietly misses the next name added
 * here.
 *
 * **Why this is a SECOND source rather than a filter on the first.** `createPlanChangeSource`
 * answers "tell me when THIS plan changed" and every caller of it has a plan id to bind. This
 * view has none: it draws the whole vault's projects, so it wants the unfiltered category and
 * nothing else. Reusing that function would have meant passing it a plan id it has no use
 * for, matched against events that carry one.
 *
 * The LIST is the extension point — a name added here, never a second refresh path in the
 * view — and it held `ProjectIndexRebuilt` ALONE for one round under a sentence claiming that
 * was "a statement about what the bus currently carries". The bus has carried `ProjectCreated`
 * since slice 3: `CreateProject.execute` publishes one on every successful create, and the
 * only reason recorded for leaving it out was that `ViewRoot.onCreateProject` re-reads for its
 * own create. That is a reason the FORM path has an awaited re-read; it is no reason for every
 * OTHER create path to go unheard. `create-sample-project` is one such path today — it seeds
 * through the same command from the palette, so a Renovation project pane open in a background
 * leaf went on drawing the vault it had read at mount until something rebuilt the whole index.
 * Reported in review.
 *
 * **Both paths stay, and the doubled hydrate is bounded rather than tolerated.** The
 * subscription answers a CATEGORY ("some project was created, anywhere"); `onCreateProject`'s
 * `await hydrate()` answers an ORDERING its own handler needs — the list is fresh before that
 * handler returns, which a fire-and-forget bus delivery cannot promise. `hydrate` carries a
 * request ticket, so the two racing reads settle as one: the later request wins and the
 * earlier one is discarded rather than overwriting it.
 *
 * **A project note DELETED in the vault used to publish nothing at all**, and this paragraph
 * recorded that as unfixable — "`VaultChangeAdapter` drops the index entry silently … there is
 * no `ProjectDeleted` to add here until something raises one". The next review round pointed
 * at the thing that should raise it: that adapter is the SOLE index writer for every change
 * this plugin did not make itself, and it held no `EventBus`, so a create, a modify and a
 * delete alike reached the index and no view. It announces every entry it touches now
 * (`ProjectIndexEntryChanged`), which is the second list below. The row's own click still
 * answers for a note deleted between the read and the click (`ProjectOpenOutcome`), because
 * an announcement is not an ordering: it arrives after the fact, and no subscription can make
 * a list that was true a moment ago true now.
 */
const PROJECT_LIST_CHANGE_EVENTS = ['ProjectIndexRebuilt', 'ProjectCreated'] as const;

/**
 * Events that name ONE index entry, and are the list's business only when that entry is a
 * project — a SECOND list rather than a hole in the guard below, for the reason
 * `planChangeSource` gives for its own pair: letting an unmatched event through would deliver
 * every future payload-less event to every listener by accident.
 *
 * `VaultChangeAdapter` announces every entry it touches, which is the category it can
 * honestly claim — a note added by hand, copied in, or arriving through sync, of any of the
 * five entity types. Deciding which of those mean "the set of projects may have changed" is
 * THIS module's job, because this is the layer that may know both halves. Without the filter
 * the subscription would still be correct and the surface would be unusable: a synced plan or
 * a burst of zone notes would make this view re-read every project note in the vault, once per
 * note.
 */
const PROJECT_ENTRY_EVENTS = ['ProjectIndexEntryChanged'] as const;

/**
 * `DomainEvent` carries only a `type`. Narrowed with a guard rather than a cast, exactly as
 * `planChangeSource.planIdOf` is and for the same reason: an event added to the list above
 * WITHOUT this payload is then simply never delivered, instead of comparing `undefined`
 * against an entity type and matching nothing — or, if the comparison were ever inverted,
 * matching everything.
 */
function changedEntityTypeOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload;
	return typeof payload?.entityType === 'string' ? payload.entityType : null;
}

export function createProjectListChangeSource(events: EventBus): (listener: () => void) => () => void {
	return (listener: () => void) => {
		const subscriptions = [
			...PROJECT_LIST_CHANGE_EVENTS.map((type) =>
				events.subscribe(type, () => {
					listener();
				}),
			),
			...PROJECT_ENTRY_EVENTS.map((type) =>
				events.subscribe(type, (event) => {
					if (changedEntityTypeOf(event) === 'renovation-project') listener();
				}),
			),
		];
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
