/** A secondary Room context of one Work/Evidence record. A secondary link always names a zone (ADR-0021). */
export interface SpatialLink { readonly roomId: string; readonly targetId: string }
/** A record's primary context: a Room or Area when it has one, and always its stable spatial target (ADR-0029). */
export interface PrimaryContext { readonly roomId?: string; readonly targetId: string }
export interface SharedSpatialContext extends PrimaryContext { readonly links?: readonly SpatialLink[] }
export type RoomContext = Pick<SharedSpatialContext, 'roomId' | 'targetId' | 'links'>;

/** A record's context: its Room, or — when it has none — its own spatial target (ADR-0029). */
export function contextOf(item: PrimaryContext): string {
	return item.roomId ?? item.targetId;
}
/** Every context a record serves. The primary link's `roomId` is `contextOf(item)`, so a room-less record's is its own target. */
export function spatialContexts(item: SharedSpatialContext): readonly SpatialLink[] {
	return [{ roomId: contextOf(item), targetId: item.targetId }, ...item.links ?? []];
}
/** Whether `item` serves the context `context`: its primary context, or a Room it is explicitly linked to. */
export function hasRoomContext(item: RoomContext | undefined, context: string | undefined): boolean {
	return !!item && !!context && spatialContexts(item).some(link => link.roomId === context);
}
export function validSharedLinks(item: SharedSpatialContext): boolean {
	const links = spatialContexts(item);
	return links.every(link => !!link.roomId && !!link.targetId)
		&& new Set(links.map(link => JSON.stringify([link.roomId, link.targetId]))).size === links.length;
}
export function linksContent(item: SharedSpatialContext): readonly (readonly string[])[] {
	return (item.links ?? []).map(link => [link.roomId, link.targetId]);
}
