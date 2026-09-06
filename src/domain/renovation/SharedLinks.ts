/** Additional spatial contexts of one Work/Evidence record; primary ownership stays unchanged. */
export interface SpatialLink { readonly roomId: string; readonly targetId: string }
export interface SharedSpatialContext extends SpatialLink { readonly links?: readonly SpatialLink[] }
export type RoomContext = Pick<SharedSpatialContext, 'roomId' | 'links'>;

/** A shared record can serve every explicitly linked Room while retaining one owner. */
export function hasRoomContext(item: RoomContext | undefined, roomId: string | undefined): boolean {
	return !!item && !!roomId && (item.roomId === roomId || item.links?.some(link => link.roomId === roomId) === true);
}

export function spatialContexts(item: SharedSpatialContext): readonly SpatialLink[] {
	return [{ roomId: item.roomId, targetId: item.targetId }, ...item.links ?? []];
}
export function validSharedLinks(item: SharedSpatialContext): boolean {
	const links = spatialContexts(item);
	return links.every(link => !!link.roomId && !!link.targetId)
		&& new Set(links.map(link => JSON.stringify([link.roomId, link.targetId]))).size === links.length;
}
export function linksContent(item: SharedSpatialContext): readonly (readonly string[])[] {
	return (item.links ?? []).map(link => [link.roomId, link.targetId]);
}
