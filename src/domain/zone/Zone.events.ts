import type { DomainEvent } from '../../core/events/EventBus';
import type { ProjectId } from '../project/ProjectId';
import type { PlanId } from '../plan/PlanId';
import type { ZoneId } from './ZoneId';

export interface ZoneEventPayload {
	readonly zoneId: ZoneId;
	readonly planId: PlanId;
	readonly projectId: ProjectId;
}

export interface ZoneCreated extends DomainEvent<'ZoneCreated'> {
	readonly payload: ZoneEventPayload;
}

export interface ZoneGeometryChanged extends DomainEvent<'ZoneGeometryChanged'> {
	readonly payload: ZoneEventPayload;
}

export interface ZoneDeleted extends DomainEvent<'ZoneDeleted'> {
	readonly payload: ZoneEventPayload;
}

export function zoneCreated(payload: ZoneEventPayload): ZoneCreated {
	return { type: 'ZoneCreated', payload };
}

export function zoneGeometryChanged(payload: ZoneEventPayload): ZoneGeometryChanged {
	return { type: 'ZoneGeometryChanged', payload };
}

export function zoneDeleted(payload: ZoneEventPayload): ZoneDeleted {
	return { type: 'ZoneDeleted', payload };
}
