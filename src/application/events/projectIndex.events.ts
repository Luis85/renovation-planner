import type { DomainEvent } from '../../core/events/EventBus';
import type { EntityId } from '../../core/identity/EntityId';
import type { EntityType } from '../ports/ProjectIndex';

/**
 * The Project Index was (re)built — the one fact a view needs that no entity emits.
 *
 * It lives in `application/` rather than beside a domain entity because it is about a
 * PORT, not about a Project, a Plan or a Zone: `ProjectIndex.rebuild` is the only thing
 * that can raise it, and nothing in `domain/` knows that an index exists.
 *
 * **Why anything needs telling.** The index scan runs from `onLayoutReady`, never from
 * `onload` — a vault-wide scan competing with workspace restoration builds a partial index
 * that looks complete (SDD §47, and the reason is written at the call site). But Obsidian
 * RESTORES ITS LEAVES BEFORE layout-ready, so a Plan Editor reopened with the app hydrates
 * against an index that is still empty: `getPath` answers nothing, the read is a
 * legitimate `ok(null)`, and the view says "This plan no longer exists" about a plan that
 * does. Reported from a real vault, on the first of two restored leaves — the second was
 * fine because Obsidian defers a non-active leaf's view until it is activated, by which
 * time the scan has run.
 *
 * Carries no payload, and that is the whole point of it being its own event: a rebuild
 * says nothing about WHICH entities changed, so every subscriber has to re-read. An event
 * with a plan id would be a promise this cannot keep.
 */
export type ProjectIndexRebuilt = DomainEvent<'ProjectIndexRebuilt'>;

export function projectIndexRebuilt(): ProjectIndexRebuilt {
	return { type: 'ProjectIndexRebuilt' };
}

/**
 * ONE entry in the Project Index changed out of band — the vault-change pipeline's own
 * announcement, and the counterpart to the rebuild above rather than a smaller version of it.
 *
 * It exists because `ProjectIndexRebuilt` had exactly one publisher for four slices —
 * `RenovationPlannerPlugin.startPersistence`, at layout-ready and on a settings swap — while
 * `VaultChangeAdapter` is the SOLE index writer for every change this plugin did not make
 * itself: a note added by hand, copied in, or arriving through sync. That adapter held no
 * `EventBus` at all, so every one of those changes reached the index and no view. A mounted
 * Renovation Project pane went on drawing the vault it had read at mount, indefinitely; the
 * module that turns this vocabulary into a subscription had recorded the DELETE half of the
 * same gap in prose ("still publishes nothing at all") and named it unfixable "until something
 * raises one". This is that something. Reported in review.
 *
 * **It carries the entity's type, and a rebuild deliberately carries nothing.** That asymmetry
 * is the whole reason these are two events rather than one with an optional payload: a rebuild
 * says nothing about WHICH entities changed, so every subscriber must re-read, while this one
 * names exactly one entry and lets each source decide whether that entry is its business.
 * Without the type, the project list would re-read every project note in the vault for every
 * synced zone note — the subscription would be correct and the surface would be unusable.
 *
 * The id is carried for the same reason every other event in this codebase carries its
 * subject, and is used by nothing today; a plan-side source that wants "this plan's entry
 * moved" is the first caller that will need it.
 */
export interface ProjectIndexEntryChangedPayload {
	readonly entityId: EntityId<string>;
	readonly entityType: EntityType;
}

export interface ProjectIndexEntryChanged extends DomainEvent<'ProjectIndexEntryChanged'> {
	readonly payload: ProjectIndexEntryChangedPayload;
}

export function projectIndexEntryChanged(
	payload: ProjectIndexEntryChangedPayload,
): ProjectIndexEntryChanged {
	return { type: 'ProjectIndexEntryChanged', payload };
}
