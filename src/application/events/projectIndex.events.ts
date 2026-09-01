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
 * **A RETYPE publishes two of these, one per type, and that follows from the filter rather
 * than contradicting it.** An index upsert is keyed on the id, so a note whose `type` is
 * hand-edited from one of the five to another leaves one bucket as it enters the next — two
 * facts, and each source filters on exactly one of them. Announcing only the arriving type
 * told every source except the one that needed telling: the project list matched
 * `renovation-project`, so a project retyped into a plan kept its row. Each event still names
 * one entry; there are simply two changes to name. Reported in review.
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

/**
 * A geometry SIDECAR this plugin owns changed on disk out of band — modified or deleted by
 * sync, by a hand edit, or in the file explorer.
 *
 * **It is a fact about FILES, not about the domain, and that is why it is here rather than in
 * `domain/`.** `VaultChangeAdapter` has not read the document and cannot say what changed
 * inside it; all it knows is that the bytes behind one entity's geometry are no longer the
 * ones its readers last saw. Publishing `AssetDesignChanged` or `ZoneGeometryChanged` from
 * the pipeline instead would put infrastructure beside the command sites that legitimately
 * raise those, asserting a design change it has never looked at.
 *
 * **Nor is it a second spelling of `ProjectIndexEntryChanged`**, which is why it is a third
 * event rather than a widened payload. That one means "the index changed under you", a
 * CATEGORY claim `applyUpsert`/`applyRemove` keep by being the only mutators; a sidecar
 * change need mutate nothing at all. ADR-0014 gives an asset's sidecar a DERIVED home, so the
 * index stores no mapping for it and there is nothing for a sidecar event to have moved —
 * buying an asset designer its refresh by announcing an index change that did not happen
 * would leave the next reader an invariant that is only mostly true.
 *
 * **Both kinds of sidecar are covered by one event**, and the payload is what makes that
 * possible: a plan's `.rpgeo` and an asset's are the same file type under two owners
 * (ADR-011, ADR-0014), so a subscriber filters on the entity the basename names — its type as
 * well as its id, because neither alone says the change is this leaf's business. A sidecar
 * whose basename resolves to no indexed entity names no subject and raises nothing.
 */
export interface GeometrySidecarChangedPayload {
	readonly entityId: EntityId<string>;
	readonly entityType: EntityType;
}

export interface GeometrySidecarChanged extends DomainEvent<'GeometrySidecarChanged'> {
	readonly payload: GeometrySidecarChangedPayload;
}

export function geometrySidecarChanged(
	payload: GeometrySidecarChangedPayload,
): GeometrySidecarChanged {
	return { type: 'GeometrySidecarChanged', payload };
}
