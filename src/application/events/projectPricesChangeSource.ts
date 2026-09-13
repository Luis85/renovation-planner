import type { DomainEvent, EventBus } from '../../core/events/EventBus';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { ProjectIndexEntryChangedPayload } from './projectIndex.events';
import { disposeAll, subscribeAll } from './subscriptions';

/**
 * "A project's own price for some asset may have moved, OR a project's requirements gained or
 * lost a row" — the domain event vocabulary, turned into one subscription a view can take
 * without naming an event.
 *
 * It lives in `application/` for the reason its siblings do: this layer may know both the
 * `EventBus` port and the event names, so `presentation/` gets a callback and learns
 * neither.
 *
 * **It REPORTS what changed and narrows nothing itself, which is a decision about having TWO
 * callers rather than one.** Filtering here would mean binding an active project id into the
 * source — and the Plan Editor, this module's first caller, holds a PLAN id: resolving it to a
 * project is an async read a subscription cannot wait on before deciding to skip work, so a
 * filtered source would charge the caller that cannot pay. Delivering the category unfiltered
 * is what that caller wants, exactly as `assetCatalogueChangeSource` argues for itself — and
 * it is NOT what the project pane wants, which draws exactly one project's prices and was
 * re-reading them for every other project's price in the vault.
 *
 * So the listener takes the project the change is ABOUT, and each caller decides. The Plan
 * Editor's takes no parameter at all and is unaffected; the project pane's compares against
 * the project it is drawing.
 *
 * **`null` means "cannot say — refresh anyway", never "no project".** The index arm below has
 * no project id to give: `ProjectIndexEntryChangedPayload` carries `entityId` and `entityType`
 * and nothing else, and the entry it names is a price NOTE whose owning project this source
 * would have to read the vault to learn. A narrowing caller must therefore treat `null` as a
 * MATCH — the safe direction under uncertainty, the same reading `drawsRequirement` in
 * `runtime.ts` gives its own empty-snapshot arm: a filter exists to skip work, so an unanswered
 * question does the work.
 *
 * **ONE domain event for the PRICE half, because there is one.** Set, replace and clear all
 * publish `AssetPriceOverrideChanged` — `AssetPriceOverride.events.ts` states that as its own
 * decision ("every subscriber's question is 'this project's price for this asset may have
 * moved'"), so `PRICE_CHANGE_EVENTS` is that decision read back rather than a narrowing of a
 * wider vocabulary.
 *
 * **THREE more for a different question (A2), on the Plan Editor's caller alone.** `REQUIREMENT_LIST_EVENTS`
 * below answers "the SET of rows a zone's Inspector draws just changed" — `RequirementCreated`,
 * `RequirementDeleted`, `RequirementRestored` — which had no subscriber anywhere in `src/`
 * before this. It lives in THIS module rather than a source of its own because the Plan
 * Editor already wires this source's listener straight to an unconditional reload with no
 * per-id filter: `runtime.ts`'s `context.onProjectPricesChanged(reloadInspector)` re-reads the
 * WHOLE list for the selected zone on every delivery, which is exactly what a row appearing or
 * disappearing needs and what the requirement-figures source's `drawsRequirement` guard cannot
 * give it — that guard can only match a row already in the list it is asked to refresh, so a
 * brand-new row would never pass it. The project pane's PRICES section also hears these now and
 * re-reads its price rows for a Requirement lifecycle change in its own project; harmless under
 * the same "each caller decides" rule the price events already live by, and cheaper than a
 * source of its own for three deliveries a session rarely produces.
 */
const PRICE_CHANGE_EVENTS = ['AssetPriceOverrideChanged'] as const;

/**
 * Events that name ONE index entry, and are this list's business only when that entry is a
 * price override — a SECOND list rather than a hole in the guard below, for the reason
 * `assetCatalogueChangeSource` and `planChangeSource` both give: letting an unmatched event
 * through would deliver every future payload-less event to every listener by accident.
 *
 * **This is the half no COMMAND can raise, and the list above is silent on it.** A price
 * override note edited by hand, copied in, arriving through sync, or deleted outside the two
 * commands publishes no domain event at all — `VaultChangeAdapter` is the SOLE index writer
 * for those, and what it announces is this. Without this list a mounted Inspector shows the
 * previous project price, and the provenance beside it, for the life of the leaf; the docblock
 * above says "ONE event" of the DOMAIN vocabulary, and that was read as an answer to a
 * question it was not being asked. Design slice 16 records the identical gap for the project
 * list ("the half of a staleness that no COMMAND can raise"), and this is that lesson applied
 * in the module written to carry it.
 *
 * The FILTER is what makes it usable rather than merely correct: unfiltered, a burst of synced
 * zone notes would re-read one selected zone's requirements once per note.
 */
const PRICE_ENTRY_EVENTS = ['ProjectIndexEntryChanged'] as const;

/**
 * **A third list, for a different fact than either above (A2).** `PRICE_CHANGE_EVENTS` and
 * `PRICE_ENTRY_EVENTS` both answer "this project's price for some asset may have moved" — a
 * figure on a row that is already there. These three answer a different question: the SET of
 * rows a zone's Inspector draws just changed, because a Requirement was created, deleted, or
 * restored. Landed here rather than in a source of their own (T6's ledger ruling) because the
 * Plan Editor's caller of this source already wires its listener straight to an unconditional
 * reload with no per-id filter — unlike the requirement-figures source's `drawsRequirement`
 * guard, which a brand-new row could never satisfy, since that guard can only match a row that
 * is already in the list it is asked to refresh. `RequirementRestored` is also A4's compensation
 * for the reassign arm's inline recalculation (`deleteResolution.ts`'s `AppliedStep` docblock):
 * a peer leaf that read the intermediate state now hears the correction.
 */
const REQUIREMENT_LIST_EVENTS = ['RequirementCreated', 'RequirementDeleted', 'RequirementRestored'] as const;

/**
 * `DomainEvent` carries only a `type`. Narrowed with a guard rather than a cast, exactly as
 * `assetCatalogueChangeSource.changedEntityTypeOf` is and for the same reason: an event added
 * to the list above WITHOUT this payload is then simply never delivered, instead of comparing
 * `undefined` against an entity type and matching nothing — or, if the comparison were ever
 * inverted, matching everything.
 */
function changedEntityTypeOf(event: DomainEvent): string | null {
	const payload = (event as { payload?: Partial<ProjectIndexEntryChangedPayload> }).payload;
	return typeof payload?.entityType === 'string' ? payload.entityType : null;
}

/**
 * The project a domain event names — shared by `PRICE_CHANGE_EVENTS` and
 * `REQUIREMENT_LIST_EVENTS` alike, unlike `subscriptions.ts`'s `changedEntry`/`changedSidecar`
 * pair: those stay two functions because their payloads are read differently by DIFFERENT
 * consumer files reaching for different fields, where here `AssetPriceOverrideEventPayload` and
 * `RequirementEventPayload` are two payloads read the SAME way (a bare `projectId: ProjectId`)
 * by the same two `subscribeAll` arms below — one reader typed generically over the field, not
 * over either interface, has nothing left to mislabel. Narrowed with a guard rather than a cast,
 * for the same reason `changedEntityTypeOf` above is: an event added to either list WITHOUT this
 * field reports `null` — "cannot say", which every narrowing caller treats as a match — rather
 * than an `undefined` compared against a project id and matching nothing.
 */
function changedProjectOf(event: DomainEvent): ProjectId | null {
	const payload = (event as { payload?: { projectId?: unknown } }).payload;
	return typeof payload?.projectId === 'string' ? (payload.projectId as ProjectId) : null;
}

export function createProjectPricesChangeSource(
	events: EventBus,
): (listener: (projectId: ProjectId | null) => void) => () => void {
	return (listener: (projectId: ProjectId | null) => void) => {
		const subscriptions = [
			...subscribeAll(events, PRICE_CHANGE_EVENTS, (event) => {
				listener(changedProjectOf(event));
			}),
			// `null` rather than a project id, because there is none to give: this payload is
			// `{ entityId, entityType }` and the entry is a price NOTE whose owning project only
			// a vault read could name. See the header for why that is a MATCH at every narrowing
			// caller rather than a miss.
			...subscribeAll(events, PRICE_ENTRY_EVENTS, (event) => {
				if (changedEntityTypeOf(event) === 'renovation-asset-price') listener(null);
			}),
			...subscribeAll(events, REQUIREMENT_LIST_EVENTS, (event) => {
				listener(changedProjectOf(event));
			}),
		];
		return disposeAll(subscriptions);
	};
}
