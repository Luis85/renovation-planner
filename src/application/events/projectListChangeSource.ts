import type { EventBus } from '../../core/events/EventBus';

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
 * A project note DELETED in the vault still publishes nothing at all — `VaultChangeAdapter`
 * drops the index entry silently — which is why the row's own click has to answer for it
 * (`ProjectOpenOutcome`), and there is no `ProjectDeleted` to add here until something raises
 * one.
 */
const PROJECT_LIST_CHANGE_EVENTS = ['ProjectIndexRebuilt', 'ProjectCreated'] as const;

export function createProjectListChangeSource(events: EventBus): (listener: () => void) => () => void {
	return (listener: () => void) => {
		const subscriptions = PROJECT_LIST_CHANGE_EVENTS.map((type) =>
			events.subscribe(type, () => {
				listener();
			}),
		);
		return () => {
			for (const subscription of subscriptions) subscription.dispose();
		};
	};
}
