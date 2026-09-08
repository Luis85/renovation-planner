import type { Point } from '../../../core/geometry/Point';
import type { Structure } from '../../../domain/spatial/Structure';
import type { SpatialObjectCandidate } from '../tools/select-tool';
import { structureCandidates } from '../structure/structureCandidates';

/** Visibility limits pointer admission, not persistent identity or the owning group's members. */
export function canvasCandidates(zones: Iterable<{ readonly id: string; readonly points: readonly Point[] }>, structure: Structure, visible: { readonly zone: boolean; readonly architecture: boolean }): SpatialObjectCandidate[] {
	const rooms = visible.zone ? [...zones].map(zone => ({ id: zone.id, points: zone.points })) : [];
	return visible.architecture ? [...rooms, ...structureCandidates(structure)] : rooms;
}
