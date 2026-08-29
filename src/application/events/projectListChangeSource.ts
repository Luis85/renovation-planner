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
 * The LIST is the extension point, exactly as it is there — a `ProjectCreated` or a
 * `ProjectDeleted` reaching this view is a name added here, never a second refresh path in
 * the view. It holds one entry today, and that is a statement about what the bus currently
 * carries rather than a shape: `ViewRoot.onCreateProject` re-reads for its own create because
 * it has to keep the dialog open until the write settles, and a project note DELETED in the
 * vault publishes nothing at all — `VaultChangeAdapter` drops the index entry silently, which
 * is why the row's own click has to answer for it (`ProjectOpenOutcome`).
 */
const PROJECT_LIST_CHANGE_EVENTS = ['ProjectIndexRebuilt'] as const;

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
