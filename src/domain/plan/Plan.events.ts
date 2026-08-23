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

export function planCreated(payload: PlanEventPayload): PlanCreated {
	return { type: 'PlanCreated', payload };
}

export function planCalibrated(payload: PlanEventPayload): PlanCalibrated {
	return { type: 'PlanCalibrated', payload };
}
