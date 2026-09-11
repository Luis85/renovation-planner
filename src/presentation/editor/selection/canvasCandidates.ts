import type { Point } from '../../../core/geometry/Point';
import type { Structure } from '../../../domain/spatial/Structure';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import { structureCandidates } from '../structure/structureCandidates';

/**
 * Visibility limits pointer admission, not persistent identity or the owning group's members.
 * A LOCKED zone is never admitted (ADR-0027): this is the one list `SelectTool`'s click and
 * hover, its marquee and `CanvasContextMenu` all read, so one filter makes every canvas route
 * pass through it while the sidebar still reaches it.
 */
export function canvasCandidates(zones: Iterable<{ readonly id: string; readonly points: readonly Point[]; readonly bulges?: readonly number[]; readonly locked?: boolean }>, structure: Structure, visible: { readonly zone: boolean; readonly architecture: boolean }): SpatialObjectCandidate[] {
	const rooms = visible.zone ? [...zones].filter(zone => zone.locked !== true).map(zone => ({ id: zone.id, points: zone.points, bulges: zone.bulges })) : [];
	return visible.architecture ? [...rooms, ...structureCandidates(structure)] : rooms;
}
