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

/**
 * The asset's stored DESIGN changed — its geometry sidecar, or a field the designer draws
 * from. One event for every design command rather than a per-field family, because a
 * subscriber's question is "is what I am showing still what is stored", and a list of field
 * events is a rule stated as a list: it goes stale the day a ninth command is added, silently
 * and in the direction of a stale surface. The payload carries the id so a subscriber can
 * filter, which is what keeps one event for every command affordable.
 *
 * **Its subscriber is `createAssetDesignChangeSource`**, which every designer leaf takes through
 * `AssetDesignerDeps.onDesignChanged`; publishing it from every design command is what lets a
 * peer leaf showing the same asset re-read, forward path and undo path alike.
 *
 * Deliberately NOT `AssetUpdated`, which slice 10's recalculation cascade subscribes to: that
 * event re-reads every Requirement referencing the asset, and a footprint edit changes no
 * price and no unit. Announcing it here would be a behaviour change wearing a name's clothes.
 */
export interface AssetDesignChanged extends DomainEvent<'AssetDesignChanged'> {
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
export function assetDesignChanged(payload: AssetEventPayload): AssetDesignChanged {
	return { type: 'AssetDesignChanged', payload };
}
