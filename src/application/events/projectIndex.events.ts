import type { DomainEvent } from '../../core/events/EventBus';

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
