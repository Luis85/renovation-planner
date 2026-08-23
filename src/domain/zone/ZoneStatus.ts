/**
 * SDD §38's example frontmatter shows `status: planned`; `InProgress`/`Complete` are the
 * inferred remainder of that axis.
 */
export type ZoneStatus = 'Planned' | 'InProgress' | 'Complete';

const VALUES: readonly ZoneStatus[] = ['Planned', 'InProgress', 'Complete'];

export function isZoneStatus(value: unknown): value is ZoneStatus {
	return typeof value === 'string' && VALUES.includes(value as ZoneStatus);
}
