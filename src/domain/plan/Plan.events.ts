import type { DomainEvent } from '../../core/events/EventBus';
import type { ProjectId } from '../project/ProjectId';
import type { PlanId } from './PlanId';

export interface PlanEventPayload {
	readonly planId: PlanId;
	readonly projectId: ProjectId;
}

export interface PlanCreated extends DomainEvent<'PlanCreated'> {
	readonly payload: PlanEventPayload;
}

export interface PlanCalibrated extends DomainEvent<'PlanCalibrated'> {
	readonly payload: PlanEventPayload;
}

/**
 * A Plan's background document changed — the event `SetPlanBackgroundCommand` publishes
 * (design slice 5). Carries no path: an event says what happened, and anything that needs
 * to know WHICH document re-reads the Plan, so a subscriber cannot act on a reference the
 * next write has already replaced.
 */
export interface PlanBackgroundChanged extends DomainEvent<'PlanBackgroundChanged'> {
	readonly payload: PlanEventPayload;
}

export function planBackgroundChanged(payload: PlanEventPayload): PlanBackgroundChanged {
	return { type: 'PlanBackgroundChanged', payload };
}

/** A Plan's kind or sibling order changed (ADR-0029) — what `UpdatePlanDetailsCommand` publishes. */
export interface PlanDetailsChanged extends DomainEvent<'PlanDetailsChanged'> {
	readonly payload: PlanEventPayload;
}

export function planDetailsChanged(payload: PlanEventPayload): PlanDetailsChanged {
	return { type: 'PlanDetailsChanged', payload };
}

export function planCreated(payload: PlanEventPayload): PlanCreated {
	return { type: 'PlanCreated', payload };
}

export function planCalibrated(payload: PlanEventPayload): PlanCalibrated {
	return { type: 'PlanCalibrated', payload };
}
