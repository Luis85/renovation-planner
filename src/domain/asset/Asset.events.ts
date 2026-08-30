import type { DomainEvent } from '../../core/events/EventBus';
import type { AssetId } from './AssetId';

/**
 * The asset id alone since design slice 19 — an Asset belongs to no project, and nothing
 * subscribed carried one anyway: the recalculation cascade keys on `assetId` and re-reads
 * the requirements that reference it, each of which holds its own project.
 */
export interface AssetEventPayload {
	readonly assetId: AssetId;
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
