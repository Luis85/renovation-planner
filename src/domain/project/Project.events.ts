import type { DomainEvent } from '../../core/events/EventBus';
import type { ProjectId } from './ProjectId';

export interface ProjectCreatedPayload {
	readonly projectId: ProjectId;
}

export interface ProjectCreated extends DomainEvent<'ProjectCreated'> {
	readonly payload: ProjectCreatedPayload;
}

export function projectCreated(payload: ProjectCreatedPayload): ProjectCreated {
	return { type: 'ProjectCreated', payload };
}
