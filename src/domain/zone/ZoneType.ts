/**
 * PRD §15's zone examples, closed with `Custom` as the escape hatch. The PRD gives
 * examples rather than a closed enum; this is the best-effort closure design slice 3
 * records.
 */
export type ZoneType =
	| 'Room'
	| 'Garden'
	| 'Terrace'
	| 'Driveway'
	| 'Roof'
	| 'ConstructionArea'
	| 'Custom';

export const ZONE_TYPES: readonly ZoneType[] = [
	'Room',
	'Garden',
	'Terrace',
	'Driveway',
	'Roof',
	'ConstructionArea',
	'Custom',
];

export function isZoneType(value: unknown): value is ZoneType {
	return typeof value === 'string' && ZONE_TYPES.includes(value as ZoneType);
}
