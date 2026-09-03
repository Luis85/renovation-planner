import type { DomainEvent } from '../../core/events/EventBus';
import type { Money } from '../../core/money/Money';
import type { ProjectId } from '../project/ProjectId';
import type { RequirementId } from './RequirementId';

export interface RequirementEventPayload {
	readonly requirementId: RequirementId;
	readonly projectId: ProjectId;
}

/**
 * The common half of every `*Changed` cost event (design slice 10, "shared payload
 * shape"): a domain event is data, so this is a payload shape the concrete events spread —
 * not a base class. `costType` and `scope` are deliberately narrow literals today
 * ('estimated', one requirement) and widened by the epic that adds Quoted/Committed/Actual
 * costs; what is bought now is that the fields a budget-rollup subscriber needs in order
 * to DISCRIMINATE exist from the first event, so adding the second cost type is a widened
 * union rather than a migration of this one's payload. (`committed` means NOT YET invoiced
 * per docs/entities/Cost item.md — a rollup summing full commitments would double-count.)
 */
export interface CostChangePayload {
	readonly costType: 'estimated';
	readonly scope: { readonly kind: 'requirement'; readonly id: RequirementId };
	readonly currency: string;
}

/** Published for later epics and the vault-change pipeline; nothing in slice 10's loop subscribes to it. */
export interface RequirementCreated extends DomainEvent<'RequirementCreated'> {
	readonly payload: RequirementEventPayload;
}

/**
 * The transient NOTIFICATION that a recalculation is owed (a UI "recalculating…"
 * affordance). Deliberately not persisted — `Requirement.recalculationStatus` is the
 * durable fact that survives this event when the recalculation itself fails.
 */
export interface RequirementInvalidated extends DomainEvent<'RequirementInvalidated'> {
	readonly payload: { readonly requirementId: RequirementId };
}

export interface RequirementRecalculated extends DomainEvent<'RequirementRecalculated'> {
	readonly payload: RequirementEventPayload;
}

/**
 * The Requirement-scoped specialization of §34's generic `CostChanged` for the one cost
 * type this slice produces (§32's worked example names these two events; §34 is an initial
 * catalog).
 */
export interface CostEstimateChanged extends DomainEvent<'CostEstimateChanged'> {
	readonly payload: CostChangePayload & {
		readonly previous: Money;
		readonly current: Money;
	};
}

/**
 * This row no longer exists. Minted by the increment that made every undo announce, because
 * the vocabulary had no member meaning it: `RequirementInvalidated` says a figure stopped
 * being trustworthy, which is a different claim about a row that is still there.
 *
 * Published by `DeleteRequirementCommand` (the exposed removal, and `remove-references`
 * resolves through it), by `ReversibleAssignAssetCommand.undo` (which deletes the
 * requirement its own execute created) and by the delete resolutions' `remove-references`
 * arm. Carries the project so a subscriber scoped to one project can filter.
 */
export interface RequirementDeleted extends DomainEvent<'RequirementDeleted'> {
	readonly payload: RequirementEventPayload;
}

/**
 * This row was written back from a snapshot — a restore, not a creation and not a
 * recalculation.
 *
 * It exists because a restore can move NO figure at all: the `delete-anyway` arm marks a
 * referent stale, and restoring the pre-state marks it current again without touching its
 * cost, so `publishIfEffectiveCostChanged` is correctly silent and the status change would
 * otherwise reach nobody. `RequirementInvalidated` is not the substitute — it claims a
 * recalculation is OWED, which is the opposite of a restore to a `current` pre-state.
 *
 * Two publishers, and having two is what earned it its place rather than a fix needing
 * something to name: `undoDeleteResolution` (a user's undo) and `recoverInterruptedSequences`
 * (a crash recovery at load). Both compute the same split —
 * `entry.outcome === 'written' ? entry.version : 'absent'` — so a `written` restore raises
 * this and an `'absent'` one raises `RequirementCreated`: one rule covering both callers
 * rather than two descriptions of one act.
 */
export interface RequirementRestored extends DomainEvent<'RequirementRestored'> {
	readonly payload: RequirementEventPayload;
}

export function requirementCreated(payload: RequirementEventPayload): RequirementCreated {
	return { type: 'RequirementCreated', payload };
}
export function requirementInvalidated(requirementId: RequirementId): RequirementInvalidated {
	return { type: 'RequirementInvalidated', payload: { requirementId } };
}
export function requirementRecalculated(payload: RequirementEventPayload): RequirementRecalculated {
	return { type: 'RequirementRecalculated', payload };
}
export function costEstimateChanged(
	payload: CostEstimateChanged['payload'],
): CostEstimateChanged {
	return { type: 'CostEstimateChanged', payload };
}
export function requirementDeleted(payload: RequirementEventPayload): RequirementDeleted {
	return { type: 'RequirementDeleted', payload };
}
export function requirementRestored(payload: RequirementEventPayload): RequirementRestored {
	return { type: 'RequirementRestored', payload };
}
