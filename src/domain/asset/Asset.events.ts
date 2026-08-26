import type { DomainEvent } from '../../core/events/EventBus';
import type { ProjectId } from '../project/ProjectId';
import type { AssetId } from './AssetId';

export interface AssetEventPayload {
	readonly assetId: AssetId;
	readonly projectId: ProjectId;
}

/** §34's initial catalog names `AssetCreated` explicitly; the other two extend it. */
export interface AssetCreated extends DomainEvent<'AssetCreated'> {
	readonly payload: AssetEventPayload;
}
export interface AssetUpdated extends DomainEvent<'AssetUpdated'> {
	readonly payload: AssetEventPayload;
}
export interface AssetDeleted extends DomainEvent<'AssetDeleted'> {
	readonly payload: AssetEventPayload;
}

export function assetCreated(payload: AssetEventPayload): AssetCreated {
	return { type: 'AssetCreated', payload };
}
export function assetUpdated(payload: AssetEventPayload): AssetUpdated {
	return { type: 'AssetUpdated', payload };
}
export function assetDeleted(payload: AssetEventPayload): AssetDeleted {
	return { type: 'AssetDeleted', payload };
}
