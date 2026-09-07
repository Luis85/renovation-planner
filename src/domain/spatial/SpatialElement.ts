import type { Point } from '../../core/geometry/Point';

/** Generic floor facts; richer asset specializations are independent of these identities. */
export type SpatialElementKind = 'object' | 'path' | 'fence' | 'measurement';
export interface SpatialElement {
	readonly id: string;
	readonly kind: SpatialElementKind;
	/** Object outlines close implicitly; linear elements keep ordered open points. */
	readonly points: readonly Point[];
}
export interface SpatialElementMetadata { readonly id: string; readonly name: string }
export type NamedSpatialElement = SpatialElement & SpatialElementMetadata;
export function validElementMetadataLinks(metadata: readonly SpatialElementMetadata[] = [], groups: readonly (readonly SpatialElement[] | undefined)[]): boolean {
	const ids = new Set(groups.flatMap(group => group?.map(item => item.id) ?? []));
	return metadata.length === ids.size && new Set(metadata.map(item => item.id)).size === ids.size && metadata.every(item => ids.has(item.id));
}
function metadataContent(items: readonly SpatialElementMetadata[]) {
	return items.toSorted((left, right) => left.id.localeCompare(right.id, 'en')).map(item => [item.id, item.name]);
}
export function sameElementMetadata(a: readonly SpatialElementMetadata[] = [], b: readonly SpatialElementMetadata[] = []): boolean {
	return JSON.stringify(metadataContent(a)) === JSON.stringify(metadataContent(b));
}
export const SPATIAL_ELEMENT_KINDS: readonly SpatialElementKind[] = ['object', 'path', 'fence', 'measurement'];

/** Derived world-millimetre length, never a second stored measurement authority. */
export function elementLength(element: SpatialElement): number {
	return element.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - element.points[index].x, point.y - element.points[index].y), 0);
}

export function validSpatialElement(element: SpatialElement): boolean {
	if (!element.id.startsWith('element-') || !SPATIAL_ELEMENT_KINDS.includes(element.kind)) return false;
	if (!element.points.every(point => [point.x, point.y].every(n => Number.isFinite(n) && Math.abs(n) <= 1e9))) return false;
	if (element.kind === 'object') return element.points.length >= 3;
	if (element.kind === 'measurement' && element.points.length !== 2) return false;
	return element.points.length >= 2 && element.points.slice(1).every((point, index) => Math.hypot(point.x - element.points[index].x, point.y - element.points[index].y) > 0);
}
