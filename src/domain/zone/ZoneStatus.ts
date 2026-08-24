/**
 * SDD §38's example frontmatter shows `status: planned`; `InProgress`/`Complete` are the
 * inferred remainder of that axis.
 */
export type ZoneStatus = 'Planned' | 'InProgress' | 'Complete';

export const ZONE_STATUSES: readonly ZoneStatus[] = ['Planned', 'InProgress', 'Complete'];

export function isZoneStatus(value: unknown): value is ZoneStatus {
	return typeof value === 'string' && ZONE_STATUSES.includes(value as ZoneStatus);
}
